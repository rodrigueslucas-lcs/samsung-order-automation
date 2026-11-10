const {publisherEnvironment} = require('../utils/jenkinsPublisherConfig.cjs');
const {xml} = require('../utils/eppJenkinsProvision.cjs');

const owner = 'Managed Samsung SMB home navigation v1';
const base = ['MX','PE','CL','CO'].map(market => 'Samsung-SMB-' + market);
const epp = ['MX','PE','CL','CO'].map(market => 'Samsung-SMB-EPP-' + market);
const operations = ['SAMSUNG-SMB-AUTOMATION','Samsung-SMB-Auth-Operations'];
const definitions = Object.freeze([
  {name:'01 - Overview',description:'All Samsung SMB QA automation lanes in one place. Use the dedicated Base Store, EPP and Auth & Ops tabs for focused monitoring. Quality Summary is a separate, existing view.',jobs:[...base,...epp,...operations]},
  {name:'02 - Base Store',description:'Four independent SMB Base Store QST lanes. These jobs keep their existing schedules, configuration and report history.',jobs:base},
  {name:'03 - EPP',description:'Four isolated EPP S2 QST lanes. Each market publishes its own quality dashboard and Allure report.',jobs:epp},
  {name:'04 - Auth and Ops',description:'Authentication operations and the original cross-market automation pipeline. No functional test status is inferred from authentication health.',jobs:operations}
]);

function routeFor(name){return '/view/' + encodeURIComponent(name);}
function viewXml(view){
  if(!definitions.some(d=>d.name===view.name))throw new Error('Unrecognized managed view.');
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<hudson.model.ListView><name>' + xml(view.name) + '</name>' +
    '<description>' + xml(owner + '. ' + view.description) + '</description>' +
    '<filterExecutors>false</filterExecutors><filterQueue>false</filterQueue>' +
    '<properties class="hudson.model.View$PropertyList"/><jobNames>' +
    '<comparator class="java.lang.String$CaseInsensitiveComparator"/>' +
    view.jobs.map(name=>'<string>'+xml(name)+'</string>').join('') +
    '</jobNames><jobFilters/><columns>' +
    '<hudson.views.StatusColumn/><hudson.views.JobColumn/>' +
    '<hudson.views.LastSuccessColumn/><hudson.views.LastFailureColumn/>' +
    '<hudson.views.LastDurationColumn/><hudson.views.BuildButtonColumn/>' +
    '</columns><recurse>false</recurse></hudson.model.ListView>';
}

async function provisionHomeViews(request,{apply=false}={}){
  if(typeof request !== 'function')throw new Error('Jenkins request adapter is required.');
  const existing = new Map();
  // Inspect every view before changing any of them.
  for(const view of definitions){
    const response=await request(routeFor(view.name)+'/config.xml');
    if(response.status === 404){existing.set(view.name,false);continue;}
    if(!response.ok)throw new Error('Home view read rejected: '+view.name);
    const config=await response.text();
    if(!config.includes(owner))throw new Error('Existing home view has another owner: '+view.name+'. Preserved.');
    existing.set(view.name,true);
  }
  if(!apply)return {applied:false,buildStarted:false,views:definitions.map(v=>({name:v.name,exists:existing.get(v.name),jobs:v.jobs}))};
  // Preflight all job dependencies before the first write.
  const allJobs=[...new Set(definitions.flatMap(v=>v.jobs))];
  for(const job of allJobs){
    const response=await request('/job/'+encodeURIComponent(job)+'/api/json?tree=name');
    if(!response.ok)throw new Error('Home view prerequisite job unavailable: '+job);
    const data=await response.json();
    if(data.name!==job)throw new Error('Home view job identity mismatch: '+job);
  }
  const crumbResponse=await request('/crumbIssuer/api/json');
  if(!crumbResponse.ok)throw new Error('Home view CSRF unavailable.');
  const crumb=await crumbResponse.json();
  if(!/^[A-Za-z0-9-]+$/.test(crumb.crumbRequestField||'')||!crumb.crumb)throw new Error('Home view CSRF response invalid.');
  const headers={'Content-Type':'application/xml',[crumb.crumbRequestField]:crumb.crumb};
  const result=[];
  for(const view of definitions){
    const current=existing.get(view.name);
    const route=current?routeFor(view.name)+'/config.xml':'/createView?name='+encodeURIComponent(view.name);
    const saved=await request(route,{method:'POST',headers,body:viewXml(view)});
    if(!saved.ok)throw new Error('Home view '+(current?'update':'creation')+' rejected: '+view.name+' HTTP '+saved.status);
    const verified=await request(routeFor(view.name)+'/api/json?tree=name,jobs[name]');
    if(!verified.ok)throw new Error('Home view verification unavailable: '+view.name);
    const data=await verified.json();
    const actual=(data.jobs||[]).map(job=>job.name).sort();
    const expected=[...view.jobs].sort();
    if(data.name!==view.name||actual.length!==expected.length||actual.some((job,i)=>job!==expected[i]))
      throw new Error('Home view membership mismatch: '+view.name);
    result.push({name:view.name,created:!current,jobs:actual});
  }
  return {applied:true,buildStarted:false,renamedJobs:false,changedDefaultView:false,views:result};
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length>1||args.some(arg=>arg!=='--apply'))throw new Error('Usage: node scripts/provision-jenkins-home-views.cjs [--apply]');
  const config=publisherEnvironment({});
  const authorization='Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64');
  const request=(route,options={})=>fetch(config.JENKINS_URL+route,{
    ...options,redirect:'manual',signal:AbortSignal.timeout(30000),
    headers:{Authorization:authorization,...options.headers}
  });
  const result=await provisionHomeViews(request,{apply:args[0]==='--apply'});
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(error=>{
  const safe=/^(?:Home view|Existing home view|Jenkins request adapter|Usage:|Incomplete Jenkins|Invalid Jenkins|Jenkins publish)/.test(error.message);
  console.error('[jenkins-home] '+(safe?error.message:'Provisioning failed; sensitive details suppressed.'));
  process.exitCode=1;
});
module.exports={owner,base,epp,operations,definitions,viewXml,provisionHomeViews,routeFor};
