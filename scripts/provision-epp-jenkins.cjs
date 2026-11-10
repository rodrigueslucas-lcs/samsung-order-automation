const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
const {provision,runtimePolicy}=require('../utils/eppJenkinsProvision.cjs');
async function main(){
 const market=process.argv[2],apply=process.argv[3]==='--apply';
 if(process.argv.length>4||process.argv[3]&&!apply)throw new Error('Usage: node scripts/provision-epp-jenkins.cjs CL [--apply]');
 const config=publisherEnvironment({}),authorization='Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64');
 const request=(route,options={})=>fetch(config.JENKINS_URL+route,{...options,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Authorization:authorization,...options.headers}});
 const result=await provision(market,{apply,request,policy:apply?runtimePolicy(market):undefined});
 console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{
 // Never log server responses, XML or runtime fixture contents.
 const message=/^(?:Credentials\.|Item\.|Job read blocked:|Credential read blocked:|SCM template read blocked:|CSRF crumb unavailable:|Existing job has|Existing credential has|Created EPP job verification failed:)/.test(error.message)?error.message:'EPP provisioning failed; sensitive details suppressed.';
 console.error('[epp-ci] '+message);process.exitCode=1;
});
module.exports={main};
