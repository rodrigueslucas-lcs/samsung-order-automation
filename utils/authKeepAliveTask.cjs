const path = require('node:path');
function xml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;'); }
function taskName(environment = 'S2') { if (!['S1','S2'].includes(environment)) throw new Error('Invalid task environment.'); return 'SamsungSMB-AuthKeepAlive-' + environment; }
function operatorTaskXml({environment='S2',root=process.cwd(),executable=process.execPath,userSid,start,script,args,intervalMinutes,description,limit}) {
 taskName(environment);
 if (!/^S-1-\d+(?:-\d+)+$/.test(userSid||'')) throw new Error('Task requires the current interactive user SID.');
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const shell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const command=path.resolve(root,'scripts',script);
 const action='& '+[executable,command,...args].map(quote).join(' ')+'; exit $LASTEXITCODE';
 const boundary=start||new Date(Date.now()+intervalMinutes*60000);
 return '<?xml version="1.0" encoding="UTF-16"?>\n'+
 '<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">'+
 '<RegistrationInfo><Description>'+xml(description)+'</Description></RegistrationInfo>'+
 '<Triggers><LogonTrigger><Enabled>true</Enabled><UserId>'+xml(userSid)+'</UserId></LogonTrigger>'+
 '<TimeTrigger><Repetition><Interval>PT'+intervalMinutes+'M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>'+xml(boundary.toISOString())+'</StartBoundary><Enabled>true</Enabled></TimeTrigger></Triggers>'+
 '<Principals><Principal id="Operator"><UserId>'+xml(userSid)+'</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>'+
 '<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable><AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>false</Hidden><WakeToRun>false</WakeToRun><ExecutionTimeLimit>'+limit+'</ExecutionTimeLimit><Priority>7</Priority></Settings>'+
 '<Actions Context="Operator"><Exec><Command>'+xml(shell)+'</Command><Arguments>'+xml('-NoProfile -NonInteractive -WindowStyle Hidden -Command "'+action+'"')+'</Arguments><WorkingDirectory>'+xml(path.resolve(root))+'</WorkingDirectory></Exec></Actions></Task>';
}
function buildTaskXml(options={}) {const environment=options.environment||'S2';return operatorTaskXml({...options,environment,script:'auth-keepalive-once.cjs',args:['--environment='+environment,'--scheduled'],intervalMinutes:15,description:'Samsung regional auth: immediate user logon and every 15 minutes; skips active builds and preserves human verification.',limit:'PT18M'});}
function buildDashboardTaskXml(options={}) {const environment=options.environment||'S2';if(!options.output)throw new Error('Dashboard task requires an explicit report directory.');return operatorTaskXml({...options,environment,script:'auth-operations-dashboard.cjs',args:['--environment='+environment,'--source-root='+path.resolve(options.root||process.cwd()),'--output='+path.resolve(options.output),'--refresh-url=/userContent/samsung-smb-auth/'+environment.toLowerCase()+'/index.html'],intervalMinutes:1,description:'Read-only Samsung auth observability: metadata, Windows task status and Jenkins GET requests only. Never starts authentication.',limit:'PT2M'});}
function assertHomologated(summary, environment, now = Date.now()) {
  const expected = new Set(['mx:primary','mx:second','pe:primary','co:primary','co:second','cl:primary']);
  const identities = summary?.identities || [];
  if (summary?.environment !== environment || !summary.ok || identities.length !== 6 || identities.some(r => !expected.delete(`${r.market}:${r.slot}`) || r.status !== 'HEALTHY' || r.audit?.accountPages !== 0 || !r.audit?.statePersisted) || expected.size || summary.finalized?.length !== 4 || summary.finalized.some(r => r.status !== 'READY') || !Number.isFinite(Date.parse(summary.generatedAt)) || now - Date.parse(summary.generatedAt) > 7200000 || Date.parse(summary.generatedAt) > now) throw new Error('Automatic scheduling requires a successful real six-identity health check from the last two hours.');
}
function assertExistingInstallation(value) {
 for(const key of ['enabled','interactiveOnly','ignoreNew','ownerMatches','commandMatches','argumentsMatch','workingDirectoryMatches','notRunning'])if(value?.[key]!==true)throw new Error('Schedule update requires an existing enabled managed task, unchanged command and no running instance.');
}
module.exports={taskName,buildTaskXml,buildDashboardTaskXml,assertHomologated,assertExistingInstallation};
