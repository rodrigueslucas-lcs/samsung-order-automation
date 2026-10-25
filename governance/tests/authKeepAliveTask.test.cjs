const {test}=require('node:test');const assert=require('node:assert/strict');const {buildTaskXml,buildDashboardTaskXml,assertHomologated}=require('../../utils/authKeepAliveTask.cjs');
test('Windows task runs immediately on user logon and every 15 minutes, without overlap or stored password',()=>{
 const xml=buildTaskXml({root:'C:/QA & Test',executable:'C:/Node/node.exe',userSid:'S-1-5-21-123',start:new Date('2026-10-23T20:00:00Z')});
 assert.match(xml,/<Interval>PT15M<\/Interval>/);assert.match(xml,/<LogonTrigger><Enabled>true<\/Enabled><UserId>S-1-5-21-123<\/UserId><\/LogonTrigger>/);assert.match(xml,/<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);assert.match(xml,/<LogonType>InteractiveToken<\/LogonType>/);assert.match(xml,/--scheduled/);assert.match(xml,/&amp;/);assert.doesNotMatch(xml,/Password|apiToken|JENKINS_API_TOKEN/);assert.match(xml,/<ExecutionTimeLimit>PT75M/);
});
test('task ceiling covers six invalid identities without cutting off the SECOND recovery wave',()=>{
 const xml=buildTaskXml({userSid:'S-1-5-21-123'});
 const ceiling=Number(/<ExecutionTimeLimit>PT(\d+)M/.exec(xml)[1]);
 const verifyMinutes=Math.ceil(6/3)*2*4;
 const recoveryMinutes=(Math.ceil(4/2)+Math.ceil(2/2))*15;
 const finalizeMinutes=1+2;
 assert.ok(ceiling>verifyMinutes+recoveryMinutes+finalizeMinutes);
 assert.ok(ceiling<=90,'task remains bounded');
 assert.match(xml,/<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
});
test('scheduler cannot be enabled using only unit tests or partial CL/PE evidence',()=>{
 assert.throws(()=>assertHomologated({environment:'S2',ok:true,identities:[{market:'cl',slot:'primary',status:'HEALTHY'}]},'S2'));
 const identities=['mx:primary','mx:second','pe:primary','co:primary','co:second','cl:primary'].map(id=>{const [market,slot]=id.split(':');return {market,slot,status:'HEALTHY',audit:{accountPages:0,statePersisted:true}};});
 const summary={environment:'S2',ok:true,identities,generatedAt:new Date().toISOString(),finalized:['mx','pe','co','cl'].map(market=>({market,status:'READY'}))};assert.doesNotThrow(()=>assertHomologated(summary,'S2'));
 summary.identities[0].audit.accountPages=1;assert.throws(()=>assertHomologated(summary,'S2'));
});

test('Windows installer uses PowerShell environment provider syntax and explicit Unicode task XML',()=>{const fs=require('node:fs');const source=fs.readFileSync('scripts/auth-keepalive-task.cjs','utf8');assert.doesNotMatch(source,/\$env\./);assert.match(source,/\$env:SMB_AUTH_TASK_NAME/);assert.match(source,/Get-Content -Encoding Unicode/);});
test('dashboard task is a one-minute read-only reporter and never runs auth or publish',()=>{const xml=buildDashboardTaskXml({root:'C:/QA & Test',executable:'C:/Node/node.exe',userSid:'S-1-5-21-123',output:'C:/Jenkins/userContent/samsung-smb-auth/s2'});assert.match(xml,/PT1M/);assert.match(xml,/auth-operations-dashboard\.cjs/);assert.match(xml,/LogonTrigger/);assert.match(xml,/InteractiveToken/);assert.match(xml,/IgnoreNew/);assert.doesNotMatch(xml,/auth-keepalive-once|auth-refresh|auth-verify|auth-publish|--publish/);assert.match(xml,/ExecutionTimeLimit>PT2M/);});
test('schedule-only migration cannot enable a missing, disabled, foreign or modified task',()=>{const {assertExistingInstallation}=require('../../utils/authKeepAliveTask.cjs');const proof={enabled:true,interactiveOnly:true,ignoreNew:true,ownerMatches:true,commandMatches:true,argumentsMatch:true,workingDirectoryMatches:true,notRunning:true};assert.doesNotThrow(()=>assertExistingInstallation(proof));for(const key of Object.keys(proof))assert.throws(()=>assertExistingInstallation({...proof,[key]:false}));assert.throws(()=>assertExistingInstallation(null));});
