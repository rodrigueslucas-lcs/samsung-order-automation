const {test}=require('node:test');const assert=require('node:assert/strict');const {buildTaskXml,assertHomologated}=require('../../utils/authKeepAliveTask.cjs');
test('Windows task is a 20-minute one-shot, with no overlapping runs and no stored password',()=>{
 const xml=buildTaskXml({root:'C:/QA & Test',executable:'C:/Node/node.exe',userSid:'S-1-5-21-123',start:new Date('2026-10-23T20:00:00Z')});
 assert.match(xml,/<Interval>PT20M<\/Interval>/);assert.match(xml,/<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);assert.match(xml,/<LogonType>InteractiveToken<\/LogonType>/);assert.match(xml,/--scheduled/);assert.match(xml,/&amp;/);assert.doesNotMatch(xml,/Password|apiToken|JENKINS_API_TOKEN/);assert.match(xml,/<ExecutionTimeLimit>PT18M/);
});
test('scheduler cannot be enabled using only unit tests or partial CL/PE evidence',()=>{
 assert.throws(()=>assertHomologated({environment:'S2',ok:true,identities:[{market:'cl',slot:'primary',status:'HEALTHY'}]},'S2'));
 const identities=['mx:primary','mx:second','pe:primary','co:primary','co:second','cl:primary'].map(id=>{const [market,slot]=id.split(':');return {market,slot,status:'HEALTHY',audit:{accountPages:0,statePersisted:true}};});
 const summary={environment:'S2',ok:true,identities,generatedAt:new Date().toISOString(),finalized:['mx','pe','co','cl'].map(market=>({market,status:'READY'}))};assert.doesNotThrow(()=>assertHomologated(summary,'S2'));
 summary.identities[0].audit.accountPages=1;assert.throws(()=>assertHomologated(summary,'S2'));
});

test('Windows installer uses PowerShell environment provider syntax and explicit Unicode task XML',()=>{const fs=require('node:fs');const source=fs.readFileSync('scripts/auth-keepalive-task.cjs','utf8');assert.doesNotMatch(source,/\$env\./);assert.match(source,/\$env:SMB_AUTH_TASK_NAME/);assert.match(source,/Get-Content -Encoding Unicode/);});
