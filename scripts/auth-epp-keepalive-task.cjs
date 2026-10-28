const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {buildEppTaskXml}=require('../utils/authKeepAliveTask.cjs');
const {jenkinsBuildsIdle}=require('../utils/authJenkinsActivity.cjs');
function assertRuntimeEvidence(report,environment,now=Date.now()){
  const expected=new Set(['MX','PE','CO','CL']),stamp=Date.parse(report?.generatedAt);
  if(report?.environment!==environment||report.store!=='EPP'||!Number.isFinite(stamp)||stamp>now||now-stamp>7200000||report.identities?.length!==4||!report.identities.some(i=>['KEEP_ALIVE_OK','REFRESHED'].includes(i.status))||report.identities.some(i=>!expected.delete(i.market)||i.environment!==environment||i.slot!=='primary'||!['KEEP_ALIVE_OK','REFRESHED','BLOCKED','HUMAN_REQUIRED'].includes(i.status))||expected.size)throw new Error('Fresh real EPP maintenance evidence is required before installation.');
}
async function main(){
  const args=process.argv.slice(2);let environment='S2',install=false;
  for(const arg of args){if(arg==='--install')install=true;else if(arg==='--print'){}else if(arg.startsWith('--environment='))environment=arg.slice(14).toUpperCase();else throw new Error('Unsupported EPP task option.');}
  if(!['S1','S2'].includes(environment)||process.platform!=='win32')throw new Error('EPP task requires Windows and S1/S2.');
  const name='SamsungSMB-EppAuthKeepAlive-'+environment;
  if(install){
    const report=JSON.parse(fs.readFileSync(path.resolve('test-results/auth-keepalive',`epp-last-cycle-${environment.toLowerCase()}-primary.json`),'utf8'));
    assertRuntimeEvidence(report,environment);
    if(!(await jenkinsBuildsIdle(process.env)).idle)throw new Error('Market builds are active; EPP task not changed.');
  }
  const shell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const run=(script,env={})=>{const r=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,...env},encoding:'utf8',windowsHide:true,timeout:30000});if(r.status!==0)throw new Error('Windows EPP task operation failed; task was not confirmed.');return r.stdout.trim();};
  const sid=run('[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value');
  const output=path.resolve('test-results/auth-keepalive',`epp-task-${environment.toLowerCase()}.xml`);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,buildEppTaskXml({environment,userSid:sid}),'utf16le');
  if(install)run('$existing=Get-ScheduledTask -TaskName $env:EPP_TASK_NAME -ErrorAction SilentlyContinue; if ($existing -and -not ($existing.Actions.Arguments -like "*auth-epp-keepalive-once.cjs*")) { throw "Unknown task owner" }; Register-ScheduledTask -TaskName $env:EPP_TASK_NAME -Xml (Get-Content -Raw -Encoding Unicode -LiteralPath $env:EPP_TASK_XML) -Force -ErrorAction Stop | Out-Null; $task=Get-ScheduledTask -TaskName $env:EPP_TASK_NAME; if ($task.Settings.MultipleInstances -ne "IgnoreNew" -or $task.Principal.LogonType -ne "Interactive") { throw "Task safety settings not proven" }',{EPP_TASK_NAME:name,EPP_TASK_XML:output});
  console.log(`[EPP task] ${install?'CONFIGURED':'GENERATED'} ${name} · logon + 15min · IgnoreNew · interactive user · no stored password; no immediate login`);
}
if(require.main===module)main().catch(()=>{console.error('[EPP task] Configuration not confirmed; inspect permissions or runtime evidence. Base Store task unchanged.');process.exitCode=1;});
module.exports={main,assertRuntimeEvidence};
