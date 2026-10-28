const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
async function configureItem({request=fetch,env=process.env,readDisplay=()=>require('./auth-operations-dashboard.cjs').readMetadata(require('node:path').resolve('playwright/.auth/jenkins-publisher.local.json'))}={}){
  const config=publisherEnvironment(env),job='/job/Samsung-SMB-Auth-Operations';
  const headers={Authorization:'Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64')};
  const call=(url,options={})=>request(config.JENKINS_URL+url,{redirect:'manual',signal:AbortSignal.timeout(30000),...options,headers:{...headers,...options.headers}});
  const response=await call(job+'/config.xml');if(!response.ok)throw new Error('Auth Operations item unavailable.');
  let xml=await response.text();
  if(!xml.includes('class="hudson.scm.NullSCM"')||!xml.includes('<displayName>🔐 Samsung-SMB-Auth-Operations</displayName>'))throw new Error('Auth Operations item ownership is not confirmed.');
  const display=readDisplay();
  const origin=env.AUTH_OPERATIONS_REFRESH_ORIGIN||display?.dashboardOrigin||config.JENKINS_URL;
  const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.origin!==origin)throw new Error('Auth Operations display origin is invalid.');
  const dashboard=origin+'/userContent/samsung-smb-auth/s2/index.html';
  const description='🔐 Samsung SMB · Auth Operations Dashboard\nDashboard ao vivo: '+dashboard+'\nSomente observabilidade. Abrir esta página não executa login, verify, refresh ou publicação de sessões.';
  const escaped=description.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  xml=xml.replace(/<description>[\s\S]*?<\/description>/,'<description>'+escaped+'</description>');
  // Preserve the existing static publisher and builder; update its public link only.
  const page='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung SMB Auth Operations</title><body><h1>🔐 Samsung SMB · Auth Operations Dashboard</h1><p><a target="_top" href="'+dashboard+'">Abrir dashboard ao vivo →</a></p><p>Somente observabilidade; nenhuma operação de auth é executada.</p></body></html>';
  const encoded=Buffer.from(page,'utf8').toString('base64');
  if(!/FromBase64String\(&apos;[A-Za-z0-9+/=]+&apos;\)/.test(xml))throw new Error('Auth Operations static publisher ownership is not confirmed.');
  xml=xml.replace(/FromBase64String\(&apos;[A-Za-z0-9+/=]+&apos;\)/,'FromBase64String(&apos;'+encoded+'&apos;)');
  const cr=await call('/crumbIssuer/api/json');if(!cr.ok)throw new Error('Jenkins crumb unavailable.');const crumb=await cr.json(),crumbHeader={[crumb.crumbRequestField]:crumb.crumb};
  const updated=await call(job+'/config.xml',{method:'POST',headers:{...crumbHeader,'Content-Type':'application/xml; charset=UTF-8'},body:xml});if(!updated.ok)throw new Error('Auth Operations item update HTTP '+updated.status+'.');
  // Historical builds and report actions are intentionally preserved.
  return{job:config.JENKINS_URL+job+'/',dashboard,authActions:0,permanentExecutors:0};
}
if(require.main===module)configureItem().then(r=>console.log('[auth:operations:item] '+JSON.stringify(r))).catch(error=>{console.error('[auth:operations:item] '+(/^(Auth Operations|Jenkins crumb)/.test(error.message)?error.message:'Update not confirmed')+' No market job or auth operation was started.');process.exitCode=1;});
module.exports={configureItem};
