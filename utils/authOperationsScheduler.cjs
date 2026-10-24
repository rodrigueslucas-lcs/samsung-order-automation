const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { taskName } = require('./authKeepAliveTask.cjs');
function safeTime(value) { const time = Date.parse(value); return Number.isFinite(time) && time > 946684800000 ? new Date(time).toISOString() : null; }
function schedulerView(input, now = Date.now()) {
  const interval = /^PT(\d+)M$/.exec(String(input?.interval || ''));
  const intervalMinutes = interval && Number(interval[1]) >= 1 && Number(interval[1]) <= 1440 ? Number(interval[1]) : null;
  const nextRun = safeTime(input?.nextRun), lastRun = safeTime(input?.lastRun);
  const result = {
    status: 'UNKNOWN', observedAt: new Date(now).toISOString(), intervalMinutes,
    startupEnabled: input?.startupEnabled === true, ignoreNew: input?.ignoreNew === true,
    interactiveOnly: input?.interactiveOnly === true, nextRun, lastRun,
    lastResult: Number.isInteger(input?.lastResult) ? input.lastResult : null,
  };
  if (!input?.known) return result;
  if (input.enabled === false) result.status = 'DISABLED';
  else if (!intervalMinutes || !result.startupEnabled || !result.ignoreNew || !result.interactiveOnly || !nextRun ||
    (Date.parse(nextRun) < now - 120000 && input.running !== true) ||
    (lastRun && now - Date.parse(lastRun) > (intervalMinutes * 3 + 2) * 60000 && input.running !== true)) result.status = 'DEGRADED';
  else result.status = 'RUNNING';
  result.executing = input.running === true;
  return result;
}
function readScheduler(environment = 'S2', { platform = process.platform, run = execFileSync, env = process.env, now = Date.now() } = {}) {
  const name = taskName(environment);
  if (platform !== 'win32') return schedulerView(null, now);
  const script = `$ErrorActionPreference='Stop'; $task=Get-ScheduledTask -TaskName '${name}'; $info=Get-ScheduledTaskInfo -TaskName '${name}'; [xml]$xml=Export-ScheduledTask -TaskName '${name}'; $ns=New-Object System.Xml.XmlNamespaceManager($xml.NameTable); $ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task'); $logon=$xml.SelectSingleNode('//t:LogonTrigger',$ns); $principal=$xml.SelectSingleNode('//t:Principal/t:UserId',$ns); $interval=$xml.SelectSingleNode('//t:TimeTrigger/t:Repetition/t:Interval',$ns); function Resolve-AuthTaskSid([string]$value){if($value -match '^S-1-'){return $value};return ([System.Security.Principal.NTAccount]$value).Translate([System.Security.Principal.SecurityIdentifier]).Value}; [pscustomobject]@{known=$true;enabled=[bool]$task.Settings.Enabled;running=($task.State -eq 'Running');interval=$interval.InnerText;startupEnabled=($null -ne $logon -and $logon.Enabled -ne 'false' -and (Resolve-AuthTaskSid $logon.UserId) -eq (Resolve-AuthTaskSid $principal.InnerText));ignoreNew=([string]$task.Settings.MultipleInstances -eq 'IgnoreNew');interactiveOnly=([string]$task.Principal.LogonType -eq 'Interactive');lastRun=$info.LastRunTime.ToUniversalTime().ToString('o');nextRun=$info.NextRunTime.ToUniversalTime().ToString('o');lastResult=[long]$info.LastTaskResult}|ConvertTo-Json -Compress`;
  try {
    const shell = path.join(env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const output = run(shell, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 32768 });
    return schedulerView(JSON.parse(output), now);
  } catch { return schedulerView(null, now); }
}
module.exports = { safeTime, schedulerView, readScheduler };

