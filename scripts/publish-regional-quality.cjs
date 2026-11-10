const fs=require('node:fs'),path=require('node:path');
const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
const {buildRegionalSummary,renderRegionalSummary,collectRegionalObservations}=require('../reporting/epp-quality/regional.cjs');
function publishSummary(model,output,jenkinsHome,io=fs){
 io.mkdirSync(output,{recursive:true});
 const json=JSON.stringify(model,null,2),html=renderRegionalSummary(model);
 io.writeFileSync(path.join(output,'summary.json'),json);io.writeFileSync(path.join(output,'index.html'),html);io.copyFileSync('reporting/executive-v3/dashboard.css',path.join(output,'dashboard.css'));
 if(!jenkinsHome)return;
 if(!path.isAbsolute(jenkinsHome)||path.basename(jenkinsHome)!=='.jenkins'||!io.existsSync(path.join(jenkinsHome,'config.xml')))throw new Error('Unproven Jenkins summary publication root.');
 const target=path.join(jenkinsHome,'userContent','samsung-smb-quality');
 io.mkdirSync(target,{recursive:true});
 if(io.realpathSync(target)!==path.resolve(target))throw new Error('Regional summary publication cannot follow a link.');
 const write=require('../utils/atomicJson').writeJsonAtomically;
 write(path.join(target,'summary.json'),model);
 // Unique temporary files and atomic rename keep readers out of partial HTML.
 const temporary=path.join(target,`index.${process.pid}.${Date.now()}.tmp`);
 io.writeFileSync(temporary,html);
 try{for(let attempt=0;attempt<7;attempt++){
  try{io.renameSync(temporary,path.join(target,'index.html'));break;}
  catch(error){if(!['EBUSY','EPERM','EACCES'].includes(error.code)||attempt===6)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*2**attempt);}
 }}finally{io.rmSync(temporary,{force:true});}
 io.copyFileSync('reporting/executive-v3/dashboard.css',path.join(target,'dashboard.css'));
 io.mkdirSync(path.join(target,'history'),{recursive:true});io.writeFileSync(path.join(target,'history',`${Date.now()}-${process.pid}.json`),json);
}
async function main(args=process.argv.slice(2),env=process.env){
 let config,manifest,output=path.resolve('test-results/quality-summary'),jenkinsHome;
 if(args[0]==='--ci'){
  if(args.length!==1||env.CI!=='1')throw new Error('Invalid CI summary request.');
  manifest=JSON.parse(fs.readFileSync('test-results/epp-ci-current.json','utf8'));
  require('./finalize-epp-jenkins.cjs').validateManifest(manifest,env);
  const authority=require('../utils/eppCiAuthority.cjs').authorityRoot({CI:'1',ENVIRONMENT:'S2',EPP_CI_AUTHORITY_ROOT:manifest.authorityRoot});
  const publisher=path.resolve(authority,'..','jenkins-publisher.local.json');
  if(manifest.reporting?.publisherConfig!==publisher)throw new Error('Regional summary observer configuration unavailable.');
  config=publisherEnvironment({},{readFile:()=>fs.readFileSync(publisher,'utf8')});
  output=path.join(manifest.output,'public/regional');
 }else{
  if(args.length&&!(args.length===2&&args[0]==='--publish'))throw new Error('Invalid regional summary arguments.');
  config=publisherEnvironment({});jenkinsHome=args[1];
 }
 const authorization='Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64');
 const request=route=>fetch(config.JENKINS_URL+route,{headers:{Authorization:authorization},redirect:'manual',signal:AbortSignal.timeout(20000)});
 const observations=await collectRegionalObservations(request);
 if(manifest){
  const quality=JSON.parse(fs.readFileSync(path.join(manifest.output,'public/quality/quality.json'),'utf8'));
  const job=`Samsung-SMB-EPP-${manifest.market}`,index=observations.findIndex(item=>item.job===job);
  const completed=observations[index];
  const parent=completed?.reportUrl?new URL(completed.reportUrl):new URL(env.JENKINS_URL||config.JENKINS_URL);
  parent.pathname=`/job/${job}/${manifest.buildNumber}/`;
  observations[index]={job,buildNumber:Number(manifest.buildNumber),environment:'S2',jenkinsResult:'RUNNING',quality,reportUrl:parent.href};
 }
 const model=buildRegionalSummary(observations);publishSummary(model,output,jenkinsHome);
 console.log(`[quality-summary] observed ${model.rows.length} independent lanes; ${jenkinsHome?'public snapshot updated':'local snapshot generated'}; no auth or build operation`);
 return model;
}
if(require.main===module)main().catch(()=>{console.error('[quality-summary] Publication failed; sensitive details suppressed.');process.exitCode=1;});
module.exports={main,publishSummary};
