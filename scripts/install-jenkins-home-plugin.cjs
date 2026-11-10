const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
const {adminJson,inspectHome}=require('../utils/jenkinsHomeWorkspace.cjs');

function manifest(text){
  const fields=Object.fromEntries(text.replace(/\r?\n /g,'').split(/\r?\n/).filter(l=>l.includes(': ')).map(l=>[l.slice(0,l.indexOf(': ')),l.slice(l.indexOf(': ')+2)]));
  if(fields['Short-Name']!=='samsung-smb-home'||!/^2\.\d+\.\d+$/.test(fields['Plugin-Version']||'')||!/^\d+\.\d+(?:\.\d+)?$/.test(fields['Jenkins-Version']||'')||fields['Support-Dynamic-Loading']!=='true')throw Error('Home plugin manifest identity, baseline or dynamic loading is invalid.');
  const dependencies=(fields['Plugin-Dependencies']||'').split(',').map(s=>{const [id,version]=s.split(':');if(!['dashboard-view','htmlpublisher'].includes(id)||!version||!/^[A-Za-z0-9_.+-]+$/.test(version))throw Error('Home plugin has an unapproved runtime dependency.');return{id,version};});
  if(dependencies.length!==2||new Set(dependencies.map(d=>d.id)).size!==2)throw Error('Home plugin runtime dependency list is invalid.');
  return{shortName:fields['Short-Name'],version:fields['Plugin-Version'],jenkins:fields['Jenkins-Version'],dependencies};
}
function artifact(file){
  const directory=path.resolve(__dirname,'../reporting/jenkins-home/plugin/target'),resolved=fs.realpathSync(file);
  if(path.dirname(resolved)!==fs.realpathSync(directory)||!/^samsung-smb-home(?:-[0-9.]+)?\.hpi$/.test(path.basename(resolved)))throw Error('Home plugin artifact must be the local Maven target HPI.');
  const bytes=fs.readFileSync(resolved);if(bytes.length>20_000_000||bytes.length<100||bytes[0]!==80||bytes[1]!==75)throw Error('Home plugin artifact is invalid.');
  const command="Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead($env:SAMSUNG_HOME_HPI); try { $e=$z.GetEntry('META-INF/MANIFEST.MF'); if($null -eq $e -or $e.Length -gt 65536){throw 'Manifest invalid'}; $r=[System.IO.StreamReader]::new($e.Open()); try { [Console]::Write($r.ReadToEnd()) } finally {$r.Dispose()} } finally {$z.Dispose()}";
  const text=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:30000,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:process.env.TEMP,SAMSUNG_HOME_HPI:resolved},maxBuffer:100000});
  return{...manifest(text),file:resolved,bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
async function install(request,info,{apply=false}={}){
  const encoded=Buffer.from(JSON.stringify({version:info.version,jenkins:info.jenkins,dependencies:info.dependencies})).toString('base64');
  const preflight=await adminJson(request,`import jenkins.model.Jenkins;import groovy.json.JsonSlurper;import groovy.json.JsonOutput;def j=Jenkins.get();j.checkPermission(Jenkins.ADMINISTER);def m=new JsonSlurper().parseText(new String('${encoded}'.decodeBase64(),'UTF-8'));if(Jenkins.getVersion().isOlderThan(new hudson.util.VersionNumber(m.jenkins)))throw new IllegalStateException('Home plugin baseline incompatible');m.dependencies.each{d->def p=j.pluginManager.getPlugin(d.id);if(p==null||!p.active||new hudson.util.VersionNumber(p.version).isOlderThan(new hudson.util.VersionNumber(d.version)))throw new IllegalStateException('Home plugin requires dependency update; preserved')};def p=j.pluginManager.getPlugin('samsung-smb-home');println(JsonOutput.toJson([installed:p!=null,active:p?.active?:false,version:p?.version]))`);
  if(!apply)return{...preflight,installedVersion:preflight.version,applied:false,version:info.version,sha256:info.sha256};
  if(preflight.installed)throw Error('Home plugin is already installed. Use native Jenkins plugin update/restart review; no automatic replacement.');
  const before=await inspectHome(request),crumb=await(await request('/crumbIssuer/api/json')).json();
  if(!/^[A-Za-z0-9-]+$/.test(crumb.crumbRequestField||'')||typeof crumb.crumb!=='string'||!crumb.crumb)throw Error('Home plugin CSRF invalid.');
  const form=new FormData();form.append('name',new Blob([info.bytes],{type:'application/octet-stream'}),'samsung-smb-home.hpi');form.append('pluginUrl','');
  const response=await request('/pluginManager/uploadPlugin',{method:'POST',headers:{[crumb.crumbRequestField]:crumb.crumb},body:form});
  if(![200,302,303].includes(response.status))throw Error('Home plugin native upload rejected: HTTP '+response.status);
  let after;
  for(let attempt=0;attempt<15;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));after=await inspectHome(request);if(after.controlCenterActive)break;
  }
  if(!after?.controlCenterActive)throw Error('Home plugin did not activate dynamically. Review native Plugin Manager; Jenkins was not restarted.');
  if(JSON.stringify(before.protectedState)!==JSON.stringify(after.protectedState)||before.jobs.some(j=>{const a=after.jobs.find(r=>r.name===j.name);return !a||a.configHash!==j.configHash||a.nextBuild!==j.nextBuild;}))throw Error('Home plugin protected configuration invariant failed.');
  return{applied:true,active:true,version:info.version,sha256:info.sha256,restarted:false,jobsChanged:false};
}
async function main(){
  const args=process.argv.slice(2);if(args.length>1||args.some(a=>a!=='--apply'))throw Error('Usage: node scripts/install-jenkins-home-plugin.cjs [--apply]');
  const info=artifact(path.resolve(__dirname,'../reporting/jenkins-home/plugin/target/samsung-smb-home.hpi')),env=publisherEnvironment({});
  const auth='Basic '+Buffer.from(env.JENKINS_USER+':'+env.JENKINS_API_TOKEN).toString('base64');
  const request=(route,options={})=>fetch(env.JENKINS_URL+route,{...options,redirect:'manual',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,...options.headers}});
  console.log(JSON.stringify(await install(request,info,{apply:args[0]==='--apply'}),null,2));
}
if(require.main===module)main().catch(error=>{console.error('[jenkins-home-plugin] '+(/^(Home plugin|Usage:)/.test(error.message)?error.message:'Operation failed; sensitive details suppressed.'));process.exitCode=1;});
module.exports={manifest,install};
