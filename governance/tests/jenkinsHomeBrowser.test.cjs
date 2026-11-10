const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs');
const {chromium}=require('@playwright/test');
const ui=require('../../reporting/jenkins-home/assets/control-center.js');
const assets=__dirname+'/../../reporting/jenkins-home/assets/';
let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();});
function data(){return{observedAt:Date.now(),jobs:ui.jobs.map((name,i)=>({name,store:i<4?'BASE_STORE':i<8?'EPP':'OPERATIONS',market:i<8?name.split('-').at(-1):'',environment:'S2',program:i>=4&&i<8?{MX:'pymesmx',PE:'pe_membership_vip',CL:'alianzas',CO:'co_epp_agre'}[name.split('-').at(-1)]:'',parameterized:i!==9,canBuild:true,completed:{number:3,result:'SUCCESS',duration:65000,startedAt:Date.now()-120000},lastSuccess:{number:3},lastFailure:{number:2},running:[],reports:['Quality Dashboard','Allure','Playwright'].map(type=>({type,build:3,url:'job/'+name+'/3/'+type.replaceAll(' ','_')+'/'})),qualityGate:i>=4&&i<8?{label:'PASSED WITH KNOWN DEFECTS',build:3}:null,authDashboardAvailable:i===9})),running:[],queue:[],executors:{total:4,busy:0,available:4}};}
async function fixture({clock=false,rootPath=''}={}){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}), page=await context.newPage(), state={data:data(),requests:[],fail:false};
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());state.requests.push({path:u.pathname,method:request.method(),body:request.postData()});
  if(u.origin!=='http://jenkins.test')return route.abort();
  if(u.pathname==='/samsung-smb-home/snapshot')return route.fulfill({status:state.fail?503:200,contentType:'application/json',body:JSON.stringify(state.data)});
  if(u.pathname==='/crumbIssuer/api/json')return state.crumbFailure?route.fulfill({status:503,body:'Unavailable'}):route.fulfill({json:{crumbRequestField:'Jenkins-Crumb',crumb:'synthetic'}});
  if(u.pathname.startsWith('/plugin/samsung-smb-home/')){const file=u.pathname.split('/plugin/samsung-smb-home/')[1];if(!/^(control-center\.(js|css)|flags\/(mx|pe|cl|co)\.svg)$/.test(file))return route.abort();return route.fulfill({contentType:file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css;charset=utf-8':'text/javascript;charset=utf-8',body:fs.readFileSync(assets+file)});}
  if(u.pathname.endsWith('/build'))return route.fulfill({contentType:'text/html',body:'<h1>Native Jenkins parameter/build flow</h1>'});
  if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/plugin/samsung-smb-home/control-center.css"></head><body><div data-smb-home="true" class="smb-home" data-root="'+rootPath+'"></div><script src="/plugin/samsung-smb-home/control-center.js"></script></body></html>'});
  return route.fulfill({contentType:'text/html',body:'<h1>Native Jenkins destination</h1>'});
 });
 if(clock)await page.clock.install();
 await page.goto('http://jenkins.test/');await page.locator('.smb-freshness').filter({hasText:'LIVE'}).waitFor();
 return{page,context,state,close:()=>context.close()};
}
test('cards render flags, escaped labels, report provenance and stacked mobile without build submission',async()=>{
 const f=await fixture({rootPath:'/'});try{
  assert.equal(await f.page.locator('.smb-flag').count(),8);
  await f.page.waitForFunction(()=>[...document.querySelectorAll('.smb-flag')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await f.page.locator('.smb-flag').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth>0).length),8);
  assert.equal(await f.page.getByText('MX — México',{exact:true}).count(),2);
  assert.equal(await f.page.locator('.smb-build-button').count(),10);
  assert.equal(await f.page.getByText('Quality Gate · #3: PASSED WITH KNOWN DEFECTS',{exact:true}).count(),4);
  for(const width of [1400,1000,390]){await f.page.setViewportSize({width,height:900});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  const positions=await f.page.locator('.smb-section').first().locator('.smb-card').evaluateAll(cards=>cards.map(c=>({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y})));
  assert.equal(positions[0].x,positions[1].x);assert.ok(positions[1].y>positions[0].y);
  f.state.data.jobs[0].program='<img src=x onerror=alert(1)>';f.state.data.jobs[0].qualityGate={label:'<script>alert(1)</script>',build:3};
  await f.page.getByRole('button',{name:'Refresh status'}).click();await f.page.getByText('<img src=x onerror=alert(1)>',{exact:false}).waitFor();
  assert.equal(await f.page.locator('.smb-context img,.smb-gate script').count(),0);
  assert.equal(f.state.requests.filter(r=>r.method==='POST').length,0);
 }finally{await f.close();}
});
test('parameterized EPP action opens review by GET with no payment submission',async()=>{
 const f=await fixture();try{await f.page.locator('[data-job="Samsung-SMB-EPP-CL"] .smb-build-button').click();await f.page.getByRole('heading',{name:'Native Jenkins parameter/build flow'}).waitFor();assert.equal(f.state.requests.filter(r=>r.method==='POST').length,0);assert.ok(f.state.requests.some(r=>r.path==='/job/Samsung-SMB-EPP-CL/build'&&r.method==='GET'));}finally{await f.close();}
});
test('non-parameterized Build Now uses native crumb-protected form once, only after an operator click',async()=>{
 const f=await fixture();try{f.state.crumbFailure=true;await f.page.locator('[data-job="Samsung-SMB-Auth-Operations"] .smb-build-button').click();await f.page.getByRole('button',{name:'Retry native Build Now'}).waitFor();assert.equal(f.state.requests.filter(r=>r.method==='POST').length,0);f.state.crumbFailure=false;const popup=f.context.waitForEvent('page');await f.page.locator('[data-job="Samsung-SMB-Auth-Operations"] .smb-build-button').click();const opened=await popup;await opened.waitForLoadState();const posts=f.state.requests.filter(r=>r.method==='POST');assert.equal(posts.length,1);assert.equal(posts[0].path,'/job/Samsung-SMB-Auth-Operations/build');assert.match(posts[0].body,/Jenkins-Crumb=synthetic/);assert.equal(await f.page.locator('[data-job="Samsung-SMB-Auth-Operations"] .smb-build-button').isDisabled(),true);}finally{await f.close();}
});
test('polling updates running/queue, retains focus/scroll, marks stale and resumes after page return',async()=>{
 const f=await fixture({clock:true});try{
  const stable=f.page.locator('[data-job="Samsung-SMB-CL"] .smb-build-button');await stable.focus();await f.page.evaluate(()=>scrollTo(0,500));const before=await f.page.evaluate(()=>scrollY);
  const run={number:4,startedAt:Date.now()-45000,elapsed:45000,duration:0};f.state.data.jobs[0].running=[run];f.state.data.running=[{name:'Samsung-SMB-MX',run}];f.state.data.queue=[{name:'Samsung-SMB-PE',id:1,since:Date.now()-10000}];f.state.data.executors={total:4,busy:1,available:3};
  await f.page.clock.fastForward(15000);await f.page.getByText('View running #4',{exact:true}).waitFor();
  assert.equal(await f.page.locator('[data-job="Samsung-SMB-PE"] .smb-build-button').innerText(),'Queued · view job');
  assert.equal(await stable.evaluate(n=>n===document.activeElement),true);assert.ok(Math.abs(await f.page.evaluate(()=>scrollY)-before)<2);
  f.state.fail=true;await f.page.getByRole('button',{name:'Refresh status'}).click();await f.page.locator('.smb-stale').waitFor();assert.match(await f.page.locator('.smb-freshness').innerText(),/STALE.*Last verified/);
  f.state.fail=false;f.state.data.observedAt=Date.now();await f.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));const count=f.state.requests.length;await f.page.clock.fastForward(30000);assert.equal(f.state.requests.length,count);await f.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await f.page.locator('.smb-freshness').filter({hasText:'LIVE'}).waitFor();
 }finally{await f.close();}
});
