const fs=require('node:fs');
const {publisherEnvironment}=require('./jenkinsPublisherConfig.cjs');
async function publishBundle(config,file,env=process.env,{request=fetch}={}) {
  const bundle=JSON.parse(fs.readFileSync(file,'utf8'));
  require('./eppKeepAlive.cjs').validateBundle(config,bundle);
  const cfg=publisherEnvironment(env);
  const id=`samsung-epp-${config.market.toLowerCase()}-${config.environment.toLowerCase()}-${config.authSlot||'primary'}${config.programNamespace?'-'+config.programNamespace:''}-session-bundle`;
  const headers={Authorization:'Basic '+Buffer.from(cfg.JENKINS_USER+':'+cfg.JENKINS_API_TOKEN).toString('base64')};
  const read=async(relative,options={})=>request(cfg.JENKINS_URL+relative,{redirect:'manual',signal:AbortSignal.timeout(30000),...options,headers:{...headers,...options.headers}});
  const domain='/manage/credentials/store/system/domain/_',credential=domain+'/credential/'+id;
  const crumbResponse=await read('/crumbIssuer/api/json');
  if(!crumbResponse.ok)throw new Error('EPP Jenkins crumb unavailable.');
  const crumb=await crumbResponse.json();
  const exists=await read(credential+'/api/json');
  if(exists.status!==404&&!exists.ok)throw new Error('EPP Jenkins credential lookup failed.');
  const bytes=fs.readFileSync(file).toString('base64');
  const xml='<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl><scope>GLOBAL</scope><id>'+id+'</id><description>Verified isolated EPP '+config.market+' '+config.environment+' '+(config.authSlot||'primary')+'</description><fileName>'+id+'.json</fileName><secretBytes>'+bytes+'</secretBytes></org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>';
  const result=await read(exists.ok?credential+'/config.xml':domain+'/createCredentials',{method:'POST',headers:{[crumb.crumbRequestField]:crumb.crumb,'Content-Type':'application/xml'},body:xml});
  if(!result.ok)throw new Error('EPP Jenkins credential publication failed.');
  if(!(await read(credential+'/api/json')).ok)throw new Error('EPP Jenkins publication acknowledgement missing.');
  return {credentialId:id,contentHash:require('./eppKeepAlive.cjs').contentHash(bundle)};
}
module.exports={publishBundle};
