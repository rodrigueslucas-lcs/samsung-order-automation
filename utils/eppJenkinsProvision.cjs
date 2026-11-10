const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {programmes}=require('../scripts/run-epp-jenkins.cjs');
const ownership='Managed isolated EPP S2 pipeline v1';
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function runtimePolicy(market,{workspace=process.cwd(),io=fs,hostname=os.hostname()}={}){
 if(!Object.hasOwn(programmes,market))throw new Error('Unsupported EPP market.');
 const source=JSON.parse(io.readFileSync(path.join(workspace,'playwright/.auth/epp/runtime-data.json'),'utf8'));
 if(!source.S2?.[market])throw new Error('Approved EPP S2 fixtures unavailable.');
 const policy={market,environment:'S2',program:programmes[market],hostname,authorityRoot:path.resolve(workspace,'playwright/.auth/epp'),fixtures:{S2:{[market]:source.S2[market]}}};
 if(['CL','CO'].includes(market))policy.cardFixture=JSON.parse(io.readFileSync(path.join(workspace,'playwright/.auth',market==='CL'?'cl-test-card.json':'mx-test-card.json'),'utf8'));
 return policy;
}
function jobXml(template){
 const definition=template.match(/<definition\b[^>]*>[\s\S]*?<\/definition>/)?.[0];
 if(!definition||!definition.includes('<scriptPath>Jenkinsfile</scriptPath>')||!definition.includes('agent/mx-qst-p1-finish')||!definition.includes('samsung-order-automation.git'))throw new Error('Approved SCM template unavailable.');
 return `<?xml version="1.0" encoding="UTF-8"?><flow-definition><description>${ownership}. Manual execution; existing Base Store configuration unchanged.</description><keepDependencies>false</keepDependencies><properties><org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty/><hudson.model.ParametersDefinitionProperty><parameterDefinitions><hudson.model.BooleanParameterDefinition><name>ALLOW_PAYMENT_SUBMIT</name><description>Authorize new single-shot staging orders</description><defaultValue>true</defaultValue></hudson.model.BooleanParameterDefinition><hudson.model.StringParameterDefinition><name>P1_TARGET_IDS</name><description>Optional official EPP SAM IDs</description><defaultValue></defaultValue><trim>true</trim></hudson.model.StringParameterDefinition></parameterDefinitions></hudson.model.ParametersDefinitionProperty></properties>${definition.replace('<scriptPath>Jenkinsfile</scriptPath>','<scriptPath>Jenkinsfile.epp</scriptPath>')}<triggers/><disabled>false</disabled></flow-definition>`;
}
function credentialXml(market,policy){
 if(policy.market!==market||policy.environment!=='S2'||policy.program!==programmes[market])throw new Error('EPP policy scope mismatch.');
 const id=`samsung-epp-${market.toLowerCase()}-s2-ci-runtime`;
 return `<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl><scope>GLOBAL</scope><id>${id}</id><description>${ownership} runtime ${market}</description><fileName>${id}.json</fileName><secretBytes>${Buffer.from(JSON.stringify(policy)).toString('base64')}</secretBytes></org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>`;
}
async function provision(market,{apply=false,request,policy}={}){
 if(!Object.hasOwn(programmes,market)||typeof request!=='function')throw new Error('Invalid EPP provisioning request.');
 const name=`Samsung-SMB-EPP-${market}`,resource='/job/'+name,domain='/manage/credentials/store/system/domain/_',credential=domain+`/credential/samsung-epp-${market.toLowerCase()}-s2-ci-runtime`;
 const template=await request('/job/Samsung-SMB-CL/config.xml');if(!template.ok)throw new Error(`SCM template read blocked: HTTP ${template.status}.`);
 const config=jobXml(await template.text());
 const existing=await request(resource+'/config.xml');
 if(existing.status!==404){if(!existing.ok)throw new Error(`Job read blocked: HTTP ${existing.status}.`);if(!(await existing.text()).includes(ownership))throw new Error('Existing job has another owner; preserved.');}
 const stored=await request(credential+'/config.xml');
 if(stored.status!==404){if(!stored.ok)throw new Error(`Credential read blocked: HTTP ${stored.status}.`);if(!(await stored.text()).includes(ownership))throw new Error('Existing credential has another owner; preserved.');}
 if(!apply)return {name,jobExists:existing.ok,credentialExists:stored.ok,applied:false};
 const crumbResponse=await request('/crumbIssuer/api/json');if(!crumbResponse.ok)throw new Error(`CSRF crumb unavailable: HTTP ${crumbResponse.status}.`);
 const crumb=await crumbResponse.json(),headers={'Content-Type':'application/xml',[crumb.crumbRequestField]:crumb.crumb};
 const credentialResult=await request(stored.ok?credential+'/config.xml':domain+'/createCredentials',{method:'POST',headers,body:credentialXml(market,policy)});
 if(!credentialResult.ok)throw new Error(`Credentials.${stored.ok?'Update':'Create'} blocked: HTTP ${credentialResult.status}.`);
 const jobResult=await request(existing.ok?resource+'/config.xml':'/createItem?name='+encodeURIComponent(name),{method:'POST',headers,body:config});
 if(!jobResult.ok)throw new Error(`Item.${existing.ok?'Configure':'Create'} blocked: HTTP ${jobResult.status}. Runtime credential created; no build started.`);
 const verified=await request(resource+'/api/json?tree=name,buildable');if(!verified.ok)throw new Error(`Created EPP job verification failed: HTTP ${verified.status}.`);
 return {name,applied:true,verified:true,buildStarted:false};
}
module.exports={runtimePolicy,jobXml,credentialXml,provision,ownership,xml};
