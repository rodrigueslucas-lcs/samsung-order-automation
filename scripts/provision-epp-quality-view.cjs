const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
const {xml}=require('../utils/eppJenkinsProvision.cjs');
const name='Samsung SMB Quality Summary',owner='Managed eight-lane quality observation v1';
const jobs=['MX','PE','CO','CL'].flatMap(market=>[`Samsung-SMB-${market}`,`Samsung-SMB-EPP-${market}`]);
function viewXml(){return `<?xml version="1.0" encoding="UTF-8"?><hudson.model.ListView><name>${name}</name><description>${xml(owner+'. <a href="/userContent/samsung-smb-quality/index.html">Open Regional Quality Summary</a>. Base Store and EPP results remain independent.')}</description><filterExecutors>false</filterExecutors><filterQueue>false</filterQueue><properties class="hudson.model.View$PropertyList"/><jobNames><comparator class="java.lang.String$CaseInsensitiveComparator"/>${jobs.map(job=>`<string>${job}</string>`).join('')}</jobNames><jobFilters/><columns><hudson.views.StatusColumn/><hudson.views.JobColumn/><hudson.views.LastSuccessColumn/><hudson.views.LastFailureColumn/><hudson.views.LastDurationColumn/><hudson.views.BuildButtonColumn/></columns><recurse>false</recurse></hudson.model.ListView>`;}
async function provisionView(request,{apply=false}={}){
 const route='/view/'+encodeURIComponent(name),existing=await request(route+'/config.xml');
 if(existing.status!==404){if(!existing.ok)throw new Error('Quality view read rejected.');if(!(await existing.text()).includes(owner))throw new Error('Existing quality view has another owner; preserved.');}
 if(!apply)return{name,exists:existing.ok,applied:false};
 for(const job of jobs){const response=await request('/job/'+job+'/api/json?tree=name');if(!response.ok)throw new Error('Quality view prerequisite job unavailable: '+job);}
 const response=await request('/crumbIssuer/api/json');if(!response.ok)throw new Error('Quality view CSRF unavailable.');const crumb=await response.json();
 const saved=await request(existing.ok?route+'/config.xml':'/createView?name='+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/xml',[crumb.crumbRequestField]:crumb.crumb},body:viewXml()});
 if(!saved.ok)throw new Error('View.Create/Configure rejected: HTTP '+saved.status);
 const checked=await request(route+'/api/json?tree=jobs[name]');if(!checked.ok)throw new Error('Quality view verification unavailable.');
 const actual=(await checked.json()).jobs.map(job=>job.name);
 if(actual.length!==8||jobs.some(job=>!actual.includes(job)))throw new Error('Quality view membership mismatch.');
 return{name,applied:true,jobs:actual,authOperations:false,buildStarted:false};
}
async function main(){
 if(process.argv.slice(2).some(arg=>arg!=='--apply')||process.argv.length>3)throw new Error('Invalid quality view arguments.');
 const config=publisherEnvironment({}),authorization='Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64');
 const request=(route,options={})=>fetch(config.JENKINS_URL+route,{...options,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Authorization:authorization,...options.headers}});
 console.log(JSON.stringify(await provisionView(request,{apply:process.argv[2]==='--apply'})));
}
if(require.main===module)main().catch(error=>{console.error('[quality-view] '+(/^(?:Quality view|Existing quality|View.Create)/.test(error.message)?error.message:'Failed; sensitive details suppressed.'));process.exitCode=1;});
module.exports={viewXml,provisionView,jobs,owner,name};
