const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('../../reporting/jenkins-home/assets/control-center.js');
const view = require('../../reporting/jenkins-home/view.cjs');
const fixture = () => ({observedAt: Date.now(), jobs: [{name: ui.jobs[0], store:'BASE_STORE', running:[], reports:[], canBuild:true, parameterized:true, completed:{number:10,result:'FAILURE',duration:15000}}], running:[], queue:[], executors:{total:4,busy:0,available:4}});

test('eight market cards use reliable local flag assets and exact approved country labels', () => {
  assert.deepEqual(view.jobs, ui.jobs);
  assert.deepEqual(ui.labels, {MX:'MX — México',PE:'PE — Peru',CL:'CL — Chile',CO:'CO — Colômbia'});
  for (const market of ['mx','pe','cl','co']) {
    const svg = fs.readFileSync(path.resolve(__dirname,'../../reporting/jenkins-home/assets/flags',market+'.svg'),'utf8');
    assert.match(svg,/<svg/); assert.doesNotMatch(svg,/<script|foreignObject|href=/i);
  }
});
test('parameterized build action opens the native review flow and never supplies payment flags', () => {
  const job=fixture().jobs[0], build=ui.action(job,[]);
  assert.equal(build.kind,'parameters'); assert.equal(build.path,'/job/Samsung-SMB-MX/build?delay=0sec');
  assert.doesNotMatch(build.path,/ALLOW_|SUBMIT|buildWithParameters|token=/);
  assert.equal(ui.action({...job,parameterized:false},[]).kind,'native-post');
  assert.equal(ui.action({...job,canBuild:false},[]).kind,'disabled');
});
test('active and queued jobs cannot produce another build action', () => {
  const job=fixture().jobs[0];
  assert.deepEqual(ui.action({...job,running:[{number:11}]},[]),{label:'View running #11',path:'/job/Samsung-SMB-MX/11/',kind:'running'});
  assert.equal(ui.action(job,[{name:job.name}]).kind,'queued');
  assert.equal(ui.status({...job,running:[{number:11}]},[]),'RUNNING');
  assert.equal(ui.status(job,[{name:job.name}]),'QUEUED');
});
test('Jenkins results and operational metrics preserve actual states without upgrading QA quality', () => {
  const s=fixture();assert.equal(ui.status(s.jobs[0],[]),'FAILURE');
  assert.equal(ui.status({...s.jobs[0],completed:null},[]),'NOT BUILT');
  assert.equal(ui.status({...s.jobs[0],completed:{result:'invented'}},[]),'UNKNOWN');
  for(const result of ['SUCCESS','FAILURE','UNSTABLE','ABORTED'])assert.equal(ui.status({...s.jobs[0],completed:{result}},[]),result);
  assert.deepEqual(ui.metrics(s),{total:1,running:0,queued:0,failed:1,base:1,epp:0});
  assert.equal(ui.duration(7545000),'2h 5m 45s');assert.equal(ui.duration(null),'Unavailable');
});
test('report links require actual build provenance and a same-job approved route', () => {
  const job=fixture().jobs[0];
  assert.equal(ui.safeReport(job,{type:'Allure',build:10,url:'job/Samsung-SMB-MX/10/03_Allure/'}),true);
  for(const report of [{type:'Allure',build:10,url:'https://foreign/Allure/'},{type:'Allure',build:10,url:'job/Samsung-SMB-PE/10/03_Allure/'},{type:'Allure',build:11,url:'job/Samsung-SMB-MX/10/03_Allure/'},{type:'Allure',build:10,url:'job/Samsung-SMB-MX/10/../Allure/'},{type:'Configure',build:10,url:'job/Samsung-SMB-MX/10/configure/'}])assert.equal(ui.safeReport(job,report),false);
});
test('invalid, cross-job and duplicate live projections are rejected', () => {
  assert.equal(ui.validate(fixture()).jobs.length,1);
  for(const mutate of [s=>s.jobs.push(s.jobs[0]),s=>s.jobs[0].name='foreign',s=>s.queue.push({name:'foreign'}),s=>s.running.push({name:'foreign'}),s=>s.observedAt='yesterday',s=>s.executors.busy=-1]){const s=fixture();mutate(s);assert.throws(()=>ui.validate(s),/Invalid/);}
});
