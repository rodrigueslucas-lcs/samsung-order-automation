const {escape}=require('./render.cjs');
const markets=['MX','PE','CO','CL'];
const gates=['INFRA_ERROR','FAILED — NEW REGRESSION','BLOCKED BY EXTERNAL DEPENDENCIES','PASSED WITH KNOWN DEFECTS','FULLY PASSED'];
function jobName(market,store){return `Samsung-SMB-${store==='EPP'?'EPP-':''}${market}`;}
function count(value){return Number.isInteger(value)&&value>=0?value:null;}
function buildRegionalSummary(observations,{generatedAt=new Date().toISOString()}={}){
 const rows=[];
 for(const store of ['BASE_STORE','EPP'])for(const market of markets){
  const name=jobName(market,store),matches=observations.filter(item=>item.job===name);
  if(matches.length>1)throw new Error('Duplicate regional job observation.');
  const item=matches[0];
  const row={job:name,market,store,buildNumber:null,environment:'UNKNOWN',jenkinsResult:'NOT_RUN',gate:null,counts:null,reportUrl:null};
  if(item){
   if(Number.isInteger(item.buildNumber)&&item.buildNumber>0){
    row.buildNumber=item.buildNumber;
    row.jenkinsResult=['SUCCESS','FAILURE','UNSTABLE','ABORTED','NOT_BUILT','RUNNING'].includes(item.jenkinsResult)?item.jenkinsResult:'UNAVAILABLE';
    row.environment=['S1','S2'].includes(item.environment)?item.environment:'UNKNOWN';
    if(item.reportUrl){const url=new URL(item.reportUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.search||!url.pathname.includes(`/job/${name}/${item.buildNumber}/`))throw new Error('Foreign regional report URL.');row.reportUrl=url.href;}
    if(store==='EPP'&&item.quality){
     const quality=item.quality;
     const programs=require('../../config/markets/epp').S2_OPERATIONAL_PROGRAMMES;
     if(quality.market!==market||quality.environment!=='S2'||quality.program!==programs[market]||String(quality.buildNumber)!==String(item.buildNumber)||!gates.includes(quality.gate))throw new Error('Foreign EPP quality summary.');
     const expected=require('../../scripts/report-epp-homologation.cjs').inventory().filter(item=>item.market===market).length;
     const counts=Object.fromEntries(['PASS','FAIL','KNOWN_DEFECT','TEST_DATA_REQUIRED','AUTH_BLOCKED','RECONCILIATION_REQUIRED','NOT_RUN'].map(key=>[key,count(quality.counts?.[key])]));
     if(quality.official!==expected||Object.values(counts).some(value=>value===null)||Object.values(counts).reduce((sum,value)=>sum+value,0)!==expected)throw new Error('Unproven EPP quality counts.');
     row.environment='S2';row.gate=quality.gate;row.counts=counts;
    }else if(store==='BASE_STORE'&&item.runtime){
     const runtime=item.runtime;
     if(runtime.market!==market||runtime.store!=='BASE_STORE'||String(runtime.buildNumber)!==String(item.buildNumber))throw new Error('Foreign Base Store runtime summary.');
     row.counts=Object.fromEntries(['official','executed','passed','failed','blocked','notRun'].map(key=>[key,count(runtime.summary?.[key])]));
    }
   }else if(item.unavailable)row.jenkinsResult='UNAVAILABLE';
  }
  rows.push(row);
 }
 return {schemaVersion:1,generatedAt,source:'Observed Jenkins builds; Base Store and EPP remain independent.',rows};
}
function renderRegionalSummary(model){
 const sections=['BASE_STORE','EPP'].map(store=>{
  const rows=model.rows.filter(row=>row.store===store).map(row=>`<tr><td>${escape(row.market)}</td><td>${escape(row.environment)}</td><td>${row.buildNumber?`#${row.buildNumber}`:'Not run'}</td><td>${escape(row.jenkinsResult)}</td><td>${escape(row.gate||'See existing Base Store result')}</td><td>${row.counts?Object.entries(row.counts).map(([key,value])=>`${escape(key)}: ${value===null?'unknown':value}`).join('<br>'):'Current-build counts unavailable'}</td><td>${row.reportUrl?`<a href="${escape(row.reportUrl)}">Build and reports</a>`:'Unavailable'}</td></tr>`).join('');
  return `<section><h2>${store==='EPP'?'EPP · official QST':'Base Store · existing pipeline'}</h2><div class="table-wrap"><table><thead><tr><th>Market</th><th>Env</th><th>Observed build</th><th>Jenkins result</th><th>Quality gate</th><th>Recorded counts</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
 }).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung SMB · Regional Quality Summary</title><link rel="stylesheet" href="dashboard.css"><style>body{margin:0;padding:24px}section{margin-top:28px}.table-wrap{overflow-x:auto}table{width:100%;min-width:900px}td,th{text-align:left;padding:12px;vertical-align:top}h1{overflow-wrap:anywhere}@media(max-width:600px){body{padding:12px}}</style></head><body><main><header><h1>Samsung SMB · Regional Quality Summary</h1><p>Observed ${escape(model.generatedAt)}. Updated after EPP publication; use each build link for its execution history.</p><p>Eight independent market/store lanes. Authentication health is not functional PASS. Missing or historical evidence is never promoted to a current result.</p><a href="summary.json">Observed summary JSON</a></header>${sections}</main></body></html>`;
}
async function collectRegionalObservations(request){
 const tasks=[];
 for(const store of ['BASE_STORE','EPP'])for(const market of markets)tasks.push((async()=>{
  const job=jobName(market,store),base='/job/'+job+'/lastCompletedBuild';
  const response=await request(base+'/api/json?tree=number,url,result,actions[parameters[name,value]],artifacts[relativePath]');
  if(response.status===404)return{job};
  if(!response.ok)return{job,unavailable:true};
  const build=await response.json();
  const parameter=(build.actions||[]).flatMap(action=>action.parameters||[]).find(item=>item.name==='ENVIRONMENT')?.value;
  const item={job,buildNumber:build.number,jenkinsResult:build.result,environment:store==='EPP'?'S2':parameter,reportUrl:build.url};
  const matches=(build.artifacts||[]).filter(artifact=>store==='EPP'?new RegExp(`^test-results/epp/${market.toLowerCase()}/s2/[A-Za-z0-9.-]+/public/quality/quality.json$`).test(artifact.relativePath):artifact.relativePath===`test-results/jenkins/${market.toLowerCase()}-qst/runtime-summary.json`);
  if(matches.length===1){const artifact=await request('/job/'+job+'/'+build.number+'/artifact/'+matches[0].relativePath);if(artifact.ok)item[store==='EPP'?'quality':'runtime']=await artifact.json();}
  return item;
 })().catch(()=>({job:jobName(market,store),unavailable:true})));
 return Promise.all(tasks);
}
module.exports={buildRegionalSummary,renderRegionalSummary,collectRegionalObservations,jobName};
