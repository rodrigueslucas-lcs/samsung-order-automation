const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const { buildTaskXml, taskName, assertHomologated } = require('../utils/authKeepAliveTask.cjs');
const { jenkinsBuildsIdle } = require('../utils/authJenkinsActivity.cjs');
const { leaseDirectory } = require('../utils/authMarketLease.cjs');
async function main() {
  const args = process.argv.slice(2); let environment = 'S2', mode = 'print';
  for (const arg of args) { if (arg === '--install') mode = 'install'; else if (arg === '--remove') mode = 'remove'; else if (arg === '--print') mode = 'print'; else if (arg.startsWith('--environment=')) environment = arg.slice('--environment='.length).toUpperCase(); else throw new Error('Unsupported task configuration argument.'); }
  const name = taskName(environment);
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
  assertHomologated(JSON.parse(fs.readFileSync(`test-results/auth-keepalive/last-cycle-${environment.toLowerCase()}.json`, 'utf8')), environment);
  console.log('[auth:task] configuring coordination permissions');
  const directory = leaseDirectory(); fs.mkdirSync(directory, {recursive:true});
  // The interactive operator and the usual LocalSystem Jenkins service share
  // coordination only. This directory contains no credentials/session data.
  run('& icacls.exe $env:SMB_AUTH_LEASE_DIRECTORY /grant:r ("*" + $env:SMB_AUTH_OPERATOR_SID + ":(OI)(CI)F") "*S-1-5-18:(OI)(CI)F"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }', { SMB_AUTH_LEASE_DIRECTORY:directory, SMB_AUTH_OPERATOR_SID:sid });
  const output = path.resolve('test-results/auth-keepalive', `task-${environment.toLowerCase()}.xml`);
  fs.writeFileSync(output, content, 'utf16le');
  console.log('[auth:task] registering 20-minute task');
  run('Register-ScheduledTask -TaskName $env:SMB_AUTH_TASK_NAME -Xml (Get-Content -Encoding Unicode -Raw -LiteralPath $env:SMB_AUTH_TASK_XML) -Force -ErrorAction Stop | Out-Null', { SMB_AUTH_TASK_NAME:name, SMB_AUTH_TASK_XML:output });
  console.log(`[auth:task] READY ${name}: every 20 minutes, interactive operator, IgnoreNew; no immediate auth run.`);
}
if (require.main === module) main().catch(error => { console.error('[auth:task] Task configuration was not completed (' + (error.code || 'PRECONDITION_FAILED') + '). Check real homologation evidence, Jenkins activity and Windows permissions.'); process.exitCode = 1; });
module.exports = { main };
