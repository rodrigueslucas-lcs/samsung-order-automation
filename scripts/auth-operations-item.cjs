const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
function publicLiveReportBatch(directory){
  const path=require('node:path');
  if(typeof directory!=='string'||!path.isAbsolute(directory)||/["\r\n%!^&|<>]/.test(directory)||!path.resolve(directory).replaceAll('\\','/').toLowerCase().endsWith('/usercontent/samsung-smb-auth/s2'))throw Error('Only the public live dashboard source is allowed.');
  const source=directory.replaceAll("'","''");
  const script="$ErrorActionPreference='Stop'; $source='"+source+"'; New-Item -ItemType Directory -Force -Path auth-dashboard-link > $null; $html=[IO.File]::ReadAllText((Join-Path $source 'index.html')); $html=[regex]::Replace($html,'<meta http-equiv=\\x22refresh\\x22 content=\\x22[^\\x22]*\\x22>','<meta http-equiv=refresh content=45>'); [IO.File]::WriteAllText((Join-Path (Get-Location) 'auth-dashboard-link/index.html'),$html,(New-Object Text.UTF8Encoding $false)); Copy-Item -LiteralPath (Join-Path $source 'styles.css'),(Join-Path $source 'countdown.js') -Destination auth-dashboard-link -Force";
  return '@echo off\r\npowershell.exe -NoProfile -NonInteractive -Command "'+script+'"\r\nexit /b %errorlevel%\r\n';
}
function publicAssetsBatch(assets){
  if(Object.keys(assets).sort().join(',')!=='countdown.js,index.html,styles.css')throw Error('Auth Operations requires exactly its public dashboard assets.');
  const lines=['@echo off','if not exist auth-dashboard-link mkdir auth-dashboard-link'],writes=[],temporary=[];
  // cmd.exe has an 8191-character line limit. Transfer public data in short
  // lines, then decode files; never put the full dashboard in a command line.
  for(const [name,value] of Object.entries(assets)){
    if(typeof value!=='string'||!value.length||value.length>2097152)throw Error('Invalid public dashboard asset.');
    const target='auth-dashboard-link/'+name,temp=target+'.b64',chunks=Buffer.from(value,'utf8').toString('base64').match(/.{1,900}/g);
    chunks.forEach((chunk,index)=>lines.push((index?'>>':'>')+' "'+temp+'" echo '+chunk));
    writes.push("[IO.File]::WriteAllBytes((Join-Path (Get-Location) '"+target+"'),[Convert]::FromBase64String([IO.File]::ReadAllText((Join-Path (Get-Location) '"+temp+"'))))");
    temporary.push("'"+temp+"'");
  }
  lines.push('powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference=\'Stop\'; '+writes.join('; ')+'; Remove-Item -LiteralPath '+temporary.join(',')+'"','exit /b %errorlevel%');
  return lines.join('\r\n')+'\r\n';
}
function readPublishedAssets(){
  const path=require('node:path'),fs=require('node:fs');
  const report=require('../utils/authOperationsReport.cjs').configuredReport(process.cwd(),undefined,{requireEnabled:false});
  if(!report)throw Error('Auth Operations live report directory is not configured.');
  const source=path.resolve(report,'../../../..','userContent/samsung-smb-auth/s2');
  const live=require('../utils/authOperationsReport.cjs').configuredReport(process.cwd());
  if(live)return{liveSource:source};
  const model=JSON.parse(fs.readFileSync(path.join(source,'state.json'),'utf8'));
  const display=require('./auth-operations-dashboard.cjs').readMetadata(path.resolve('playwright/.auth/jenkins-publisher.local.json'));
  return {'index.html':require('../reporting/auth-operations/render.cjs').render(model,{publication:live?'LIVE':'SNAPSHOT',refreshOrigin:display?.dashboardOrigin||''}),'styles.css':fs.readFileSync(path.join(source,'styles.css'),'utf8'),'countdown.js':fs.readFileSync(path.join(source,'countdown.js'),'utf8')};
}
async function configureItem({request=fetch,env=process.env,readAssets=readPublishedAssets,readDisplay=()=>require('./auth-operations-dashboard.cjs').readMetadata(require('node:path').resolve('playwright/.auth/jenkins-publisher.local.json'))}={}){
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
  // Preserve builder/publisher objects and history. This finite builder writes
  // only the three public report assets, never auth/session material.
  const assets=readAssets();
  const command=Object.keys(assets).join(',')==='liveSource'?publicLiveReportBatch(assets.liveSource):publicAssetsBatch(assets);
  const encode=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const builder=xml.match(/<hudson.tasks.BatchFile>[\s\S]*?<\/hudson.tasks.BatchFile>/g);
  const ownedCommand=builder?.length===1&&(builder[0].includes('FromBase64String')||(builder[0].includes('Copy-Item')&&builder[0].includes('userContent')&&builder[0].includes('samsung-smb-auth')&&builder[0].includes('auth-dashboard-link/index.html')));
  if(!ownedCommand||!xml.includes('<reportDir>auth-dashboard-link</reportDir>'))throw Error('Auth Operations static publisher ownership is not confirmed.');
  xml=xml.replace(builder[0],builder[0].replace(/<command>[\s\S]*?<\/command>/,'<command>'+encode(command)+'</command>'));
  const cr=await call('/crumbIssuer/api/json');if(!cr.ok)throw new Error('Jenkins crumb unavailable.');const crumb=await cr.json(),crumbHeader={[crumb.crumbRequestField]:crumb.crumb};
  const updated=await call(job+'/config.xml',{method:'POST',headers:{...crumbHeader,'Content-Type':'application/xml; charset=UTF-8'},body:xml});if(!updated.ok)throw new Error('Auth Operations item update HTTP '+updated.status+'.');
  // Historical builds and report actions are intentionally preserved.
  return{job:config.JENKINS_URL+job+'/',dashboard,authActions:0,permanentExecutors:0};
}
if(require.main===module)configureItem().then(r=>console.log('[auth:operations:item] '+JSON.stringify(r))).catch(error=>{console.error('[auth:operations:item] '+(/^(Auth Operations|Jenkins crumb)/.test(error.message)?error.message:'Update not confirmed')+' No market job or auth operation was started.');process.exitCode=1;});
module.exports={configureItem,publicAssetsBatch,publicLiveReportBatch};
