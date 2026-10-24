const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const { buildTaskXml, buildDashboardTaskXml, taskName, assertHomologated, assertExistingInstallation } = require('../utils/authKeepAliveTask.cjs');
const { jenkinsBuildsIdle } = require('../utils/authJenkinsActivity.cjs');
const { leaseDirectory } = require('../utils/authMarketLease.cjs');
async function main() {
  const args = process.argv.slice(2); let environment = 'S2', mode = 'print', dashboardOutput;
  for (const arg of args) { if (arg === '--install') mode = 'install'; else if (arg === '--update-schedule') mode = 'update'; else if (arg === '--remove') mode = 'remove'; else if (arg === '--print') mode = 'print'; else if (arg.startsWith('--dashboard-output=')) dashboardOutput = path.resolve(arg.slice('--dashboard-output='.length)); else if (arg.startsWith('--environment=')) environment = arg.slice('--environment='.length).toUpperCase(); else throw new Error('Unsupported task configuration argument.'); }
  const name = taskName(environment);
  if(dashboardOutput&&!dashboardOutput.toLowerCase().endsWith(path.sep+path.join('userContent','samsung-smb-auth',environment.toLowerCase()).toLowerCase()))throw new Error('Dashboard output must be its dedicated Jenkins userContent directory.');
  if (process.platform !== 'win32') throw new Error('This task installer requires Windows.');
  const powershell = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe') : 'powershell.exe';
  const run = (script, env = {}) => {
    const result = spawnSync(powershell, ['-NoProfile','-NonInteractive','-Command', script], { env: {...process.env,...env}, encoding:'utf8', windowsHide:true, timeout:90000 });
    if (result.status !== 0) { const detail = String(result.stderr || result.stdout || ''); console.error('[auth:task] Windows operation status=' + result.status + ' diagnostic=' + detail.replace(/S-1-[0-9-]+/g, '[SID]').slice(0,700)); const error = new Error('Task Scheduler operation failed.'); error.code = /Access.*denied|PermissionDenied|AccessDenied|negado|80070005/i.test(detail) ? 'TASK_ACCESS_DENIED' : /XML|XmlException|InvalidData|800413/i.test(detail) ? 'TASK_XML_REJECTED' : result.error?.code || 'TASK_OPERATION_FAILED'; throw error; }
    return result.stdout.trim();
  };
  console.log('[auth:task] resolving interactive operator');
  const sid = run('[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value');
  const content = buildTaskXml({ environment, userSid: sid });
  if (mode === 'print') { console.log(content); return; }
  const activity = await jenkinsBuildsIdle(process.env);
  if (!activity.idle) throw new Error('Samsung builds are active/queued; task configuration was not changed.');
  if (mode === 'remove') { run('Unregister-ScheduledTask -TaskName $env:SMB_AUTH_TASK_NAME -Confirm:$false -ErrorAction Stop', { SMB_AUTH_TASK_NAME:name }); console.log('[auth:task] Removed ' + name); return; }
  if(mode==='update') {
    const candidate=path.resolve('test-results/auth-keepalive',`task-candidate-${environment.toLowerCase()}.xml`);
    fs.mkdirSync(path.dirname(candidate),{recursive:true});fs.writeFileSync(candidate,content,'utf16le');
    const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
    const legacyAction='& '+quote(process.execPath)+' '+quote(path.resolve('scripts/auth-keepalive-once.cjs'))+' --environment='+environment+' --scheduled; exit $LASTEXITCODE';
    const legacyArgs='-NoProfile -NonInteractive -WindowStyle Hidden -Command "'+legacyAction+'"';
    const descriptor=run('$ErrorActionPreference="Stop"; $task=Get-ScheduledTask -TaskName $env:SMB_AUTH_TASK_NAME; [xml]$expected=Get-Content -Encoding Unicode -Raw -LiteralPath $env:SMB_AUTH_TASK_XML; $owner=$task.Principal.UserId; if($owner -notmatch "^S-1-"){$owner=([System.Security.Principal.NTAccount]$owner).Translate([System.Security.Principal.SecurityIdentifier]).Value}; [pscustomobject]@{enabled=[bool]$task.Settings.Enabled;interactiveOnly=([string]$task.Principal.LogonType -eq "Interactive");ignoreNew=([string]$task.Settings.MultipleInstances -eq "IgnoreNew");ownerMatches=($owner -eq $env:SMB_AUTH_OPERATOR_SID);notRunning=($task.State -ne "Running");commandMatches=($task.Actions.Count -eq 1 -and $task.Actions[0].Execute -eq $expected.Task.Actions.Exec.Command);argumentsMatch=($task.Actions[0].Arguments -eq $expected.Task.Actions.Exec.Arguments -or $task.Actions[0].Arguments -eq $env:SMB_AUTH_LEGACY_ARGS);workingDirectoryMatches=($task.Actions[0].WorkingDirectory -eq $expected.Task.Actions.Exec.WorkingDirectory)}|ConvertTo-Json -Compress',{SMB_AUTH_TASK_NAME:name,SMB_AUTH_TASK_XML:candidate,SMB_AUTH_OPERATOR_SID:sid,SMB_AUTH_LEGACY_ARGS:legacyArgs});
    assertExistingInstallation(JSON.parse(descriptor));
    console.log('[auth:task] Updating this operator existing enabled managed installation; auth validity is not inferred from task configuration.');
  } else {
    assertHomologated(JSON.parse(fs.readFileSync(`test-results/auth-keepalive/last-cycle-${environment.toLowerCase()}.json`, 'utf8')), environment);
  }
  console.log('[auth:task] configuring coordination permissions');
  const directory = leaseDirectory(); fs.mkdirSync(directory, {recursive:true});
  // The interactive operator and the usual LocalSystem Jenkins service share
  // coordination only. This directory contains no credentials/session data.
  run('& icacls.exe $env:SMB_AUTH_LEASE_DIRECTORY /grant:r ("*" + $env:SMB_AUTH_OPERATOR_SID + ":(OI)(CI)F") "*S-1-5-18:(OI)(CI)F"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }', { SMB_AUTH_LEASE_DIRECTORY:directory, SMB_AUTH_OPERATOR_SID:sid });
  const output = path.resolve('test-results/auth-keepalive', `task-${environment.toLowerCase()}.xml`);
  fs.writeFileSync(output, content, 'utf16le');
  console.log('[auth:task] registering logon + 15-minute task');
  run('Register-ScheduledTask -TaskName $env:SMB_AUTH_TASK_NAME -Xml (Get-Content -Encoding Unicode -Raw -LiteralPath $env:SMB_AUTH_TASK_XML) -Force -ErrorAction Stop | Out-Null', { SMB_AUTH_TASK_NAME:name, SMB_AUTH_TASK_XML:output });
  if (dashboardOutput) {
    const expectedSuffix=path.join('userContent','samsung-smb-auth',environment.toLowerCase()).toLowerCase();
    if(!dashboardOutput.toLowerCase().endsWith(path.sep+expectedSuffix)) throw new Error('Dashboard output must be the dedicated Jenkins userContent/samsung-smb-auth/environment directory.');
    const metadata=require('../utils/authOperationsStore.cjs').dataDirectory();
    for(const folder of [metadata,dashboardOutput]) {fs.mkdirSync(folder,{recursive:true});run('& icacls.exe $env:SMB_AUTH_REPORT_DIRECTORY /grant:r ("*" + $env:SMB_AUTH_OPERATOR_SID + ":(OI)(CI)F") "*S-1-5-18:(OI)(CI)F"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',{SMB_AUTH_REPORT_DIRECTORY:folder,SMB_AUTH_OPERATOR_SID:sid});}
    const reportXml=path.resolve('test-results/auth-keepalive',`dashboard-task-${environment.toLowerCase()}.xml`);
    fs.writeFileSync(reportXml,buildDashboardTaskXml({environment,userSid:sid,output:dashboardOutput}),'utf16le');
    run('Register-ScheduledTask -TaskName $env:SMB_AUTH_TASK_NAME -Xml (Get-Content -Encoding Unicode -Raw -LiteralPath $env:SMB_AUTH_TASK_XML) -Force -ErrorAction Stop | Out-Null',{SMB_AUTH_TASK_NAME:'SamsungSMB-AuthOperations-'+environment,SMB_AUTH_TASK_XML:reportXml});
    console.log('[auth:task] Read-only observability task registered: user logon + every minute, IgnoreNew.');
  }
  console.log(`[auth:task] CONFIGURED ${name}: at user logon and every 15 minutes, interactive operator, IgnoreNew; no immediate auth run.`);
}
if (require.main === module) main().catch(error => { console.error('[auth:task] Task configuration was not completed (' + (error.code || 'PRECONDITION_FAILED') + '). Check real homologation evidence, Jenkins activity and Windows permissions.'); process.exitCode = 1; });
module.exports = { main };
