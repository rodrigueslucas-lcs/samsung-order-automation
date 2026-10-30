const test = require('node:test');
const assert = require('node:assert/strict');
const { installEppNavigationGuard, blockedEppRequest, safeNavigationPath } = require('../../utils/eppNavigationGuard.cjs');
const { getEppConfig } = require('../../config/markets/epp');
async function request(url,{ method='GET',navigation=true,iframe=false }={}) {
  const blocked=blockedEppRequest(getEppConfig('MX',{}),{url,method,document:navigation,top:!iframe});
  return {action:blocked?'abort':'continue',blocked};
}
test('EPP blocks Production navigation including embedded storefronts without logging protected URLs',async()=>{
  for(const iframe of [false,true]) {
    const result = await request('https://www.samsung.com/shop/?token=synthetic-sensitive',{iframe});
    assert.equal(result.action,'abort');
    assert.equal(result.blocked.reason,'PRODUCTION_NAVIGATION_BLOCKED');
    assert.ok(!JSON.stringify(result).includes('synthetic-sensitive'));
  }
});

test('real Chromium blocks a Production redirect after multiple staging hops before contacting it', async () => {
  const http = require('node:http');
  const { chromium } = require('@playwright/test');
  let hits = [];
  const server = http.createServer((req,res) => {
    hits.push(req.url);
    if(req.url==='/healthy') { res.writeHead(302,{Location:'/ok','Set-Cookie':'epp_fixture=accepted; Path=/'});res.end();return; }
    if(req.url==='/ok') { res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Staging fixture</h1>');return; }
    res.writeHead(302, { Location: req.url === '/start' ? '/next' : 'https://shop.samsung.com/shop/?token=synthetic-only' });
    res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({channel:'chrome',headless:true});
    const context = await browser.newContext();
    const guard = await installEppNavigationGuard(context,{environment:'S2',rootUrl:new URL(`http://127.0.0.1:${server.address().port}/`)});
    const page = await context.newPage();
    await guard.protectPage(page);
    await page.goto(`http://127.0.0.1:${server.address().port}/healthy`);
    assert.equal(await page.locator('h1').textContent(),'Staging fixture');
    assert.ok((await context.cookies()).some(cookie=>cookie.name==='epp_fixture'&&cookie.value==='accepted'));
    hits=[];
    let outcome;
    try { const r=await page.goto(`http://127.0.0.1:${server.address().port}/start`);outcome={status:r?.status(),host:new URL(page.url()).hostname}; }
    catch(e) { outcome={error:e.name}; }
    assert.equal(guard.lastBlocked()?.reason,'PRODUCTION_NAVIGATION_BLOCKED',JSON.stringify({outcome,hits}));
    assert.deepEqual(hits,['/start','/next']);
    assert.deepEqual(guard.lastBlocked(),{reason:'PRODUCTION_NAVIGATION_BLOCKED',host:'shop.samsung.com',path:'/shop/'});
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
});
test('blocked navigation diagnostics omit query, identity and opaque authorization material',()=>{
  assert.equal(safeNavigationPath('https://stg.shop.samsung.com/callback?token=sensitive-fixture'),'/callback');
  assert.equal(safeNavigationPath('https://stg.shop.samsung.com/users/fixture%40example.invalid/profile'),'/users/[identity]/profile');
  assert.ok(!safeNavigationPath('https://stg.shop.samsung.com/callback/'+ 'a'.repeat(64)).includes('a'.repeat(64)));
  assert.equal(blockedEppRequest(getEppConfig('MX',{}),{url:'https://samsung.com/mx/search',document:true,top:true}).reason,'PRODUCTION_NAVIGATION_BLOCKED');
});
test('same-environment staging and Samsung Account remain navigable',async()=>{
  for(const url of ['https://stg2.shop.samsung.com/getcookie.html','https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/checkout/one','https://account.samsung.com/iam/oauth2/authorize']) assert.equal((await request(url)).action,'continue');
  assert.equal((await request('https://www.google.com/recaptcha/api2/anchor',{iframe:true})).action,'continue');
  assert.equal((await request('https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pymesmx/login/return')).action,'continue');
  assert.equal((await request('https://s1-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pymesmx/login/return')).action,'abort');
});
test('commerce writes cannot escape the selected EPP environment',async()=>{
  const suffix='/tokocommercewebservices/v2/pymesmx/users/current/carts/current/entries';
  assert.equal((await request('https://s2-smb-api-cdn.ecom-stg.samsung.com'+suffix,{navigation:false,method:'POST'})).action,'continue');
  for(const origin of ['https://s1-smb-api-cdn.ecom-stg.samsung.com','https://shop.samsung.com']) assert.equal((await request(origin+suffix,{navigation:false,method:'POST'})).action,'abort');
});

test('explicit email verification is programme-bound and opt-in; default navigation guard remains closed',()=>{
 const cfg=getEppConfig('CO',{EPP_PROGRAM:'alianzas_co'}),url='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas_co/users/current/multistore/registration/verifyEmail?token=fixture';
 assert.equal(blockedEppRequest(cfg,{url,document:true,top:true}).reason,'UNAPPROVED_NAVIGATION_BLOCKED');assert.equal(blockedEppRequest(cfg,{url,document:true,top:true,allowEmailVerification:true}),null);
 assert.equal(blockedEppRequest(cfg,{url:url.replace('/alianzas_co/','/co_epp_agre/'),document:true,top:true,allowEmailVerification:true}).reason,'UNAPPROVED_NAVIGATION_BLOCKED');assert.equal(blockedEppRequest(cfg,{url:'https://www.samsung.com/shop/',document:true,top:true,allowEmailVerification:true}).reason,'PRODUCTION_NAVIGATION_BLOCKED');
});
test('CL payment opt-in allows only genuine Flow sandbox, never Flow production or Samsung production',()=>{
 const {blockedEppRequest}=require('../../utils/eppNavigationGuard.cjs');
 const cfg={market:'CL',environment:'S2',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')};
 const req={url:'https://sandbox.flow.cl/sandbox',document:true,top:true,allowClSandbox:true};
 assert.equal(blockedEppRequest(cfg,req),null);
 assert.equal(blockedEppRequest(cfg,{...req,allowClSandbox:false}).reason,'UNAPPROVED_NAVIGATION_BLOCKED');
 assert.equal(blockedEppRequest({...cfg,market:'PE'},req).reason,'UNAPPROVED_NAVIGATION_BLOCKED');
 for(const url of ['https://www.flow.cl/','https://flow.cl/','https://sandbox.flow.cl.evil.example/','https://www.samsung.com/cl/'])assert.ok(blockedEppRequest(cfg,{...req,url}));
});
