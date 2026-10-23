const path = require('node:path');
function xml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;'); }
function taskName(environment = 'S2') { if (!['S1','S2'].includes(environment)) throw new Error('Invalid task environment.'); return `SamsungSMB-AuthKeepAlive-${environment}`; }
function buildTaskXml({ environment = 'S2', root = process.cwd(), executable = process.execPath, userSid, start = new Date(Date.now() + 1200000) }) {
  taskName(environment);
  if (!/^S-1-\d+(?:-\d+)+$/.test(userSid || '')) throw new Error('Task requires the current interactive user SID.');
  const command = path.resolve(root, 'scripts/auth-keepalive-once.cjs');
  const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
  const shell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const action = '& ' + quote(executable) + ' ' + quote(command) + ' --environment=' + environment + ' --scheduled; exit $LASTEXITCODE';
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Samsung regional auth health check every 20 minutes; skips active builds and preserves human verification.</Description></RegistrationInfo>
  <Triggers><TimeTrigger><Repetition><Interval>PT20M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>${xml(start.toISOString())}</StartBoundary><Enabled>true</Enabled></TimeTrigger></Triggers>
  <Principals><Principal id="Operator"><UserId>${xml(userSid)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable><AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>false</Hidden><WakeToRun>false</WakeToRun><ExecutionTimeLimit>PT18M</ExecutionTimeLimit><Priority>7</Priority></Settings>
  <Actions Context="Operator"><Exec><Command>${xml(shell)}</Command><Arguments>${xml('-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + action + '"')}</Arguments><WorkingDirectory>${xml(path.resolve(root))}</WorkingDirectory></Exec></Actions>
</Task>`;
}
function assertHomologated(summary, environment, now = Date.now()) {
  const expected = new Set(['mx:primary','mx:second','pe:primary','co:primary','co:second','cl:primary']);
  const identities = summary?.identities || [];
  if (summary?.environment !== environment || !summary.ok || identities.length !== 6 || identities.some(r => !expected.delete(`${r.market}:${r.slot}`) || r.status !== 'HEALTHY' || r.audit?.accountPages !== 0 || !r.audit?.statePersisted) || expected.size || summary.finalized?.length !== 4 || summary.finalized.some(r => r.status !== 'READY') || !Number.isFinite(Date.parse(summary.generatedAt)) || now - Date.parse(summary.generatedAt) > 7200000 || Date.parse(summary.generatedAt) > now) throw new Error('Automatic scheduling requires a successful real six-identity health check from the last two hours.');
}
module.exports = { taskName, buildTaskXml, assertHomologated };
