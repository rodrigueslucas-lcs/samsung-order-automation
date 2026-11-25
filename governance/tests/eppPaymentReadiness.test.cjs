const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {chromium,expect}=require('@playwright/test');
const {watchMxEppPaymentRead,recoverMxEppPaymentRead}=require('../../utils/eppPaymentReadiness.cjs');
const cfg={market:'MX',environment:'S2',program:'pymesmx',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')};
const payment=new URL('checkout/one?step=CHECKOUT_STEP_PAYMENT',cfg.rootUrl).href;
const api='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes';
const req=(url=api,method='GET')=>({url:()=>url,method:()=>method});
test('readiness diagnostics expose only read status and ignored transition step',()=>{
 const page=new EventEmitter();let url=payment.replace('PAYMENT','DELIVERY');page.url=()=>url;
 const watch=watchMxEppPaymentRead(page,cfg);page.emit('request',req(api+'?private=not-for-report'));
 assert.equal(watch.snapshot().ignoredOwnReadStep,'CHECKOUT_STEP_DELIVERY');
 assert.equal(watch.snapshot().observed,false);assert.equal(watch.claimRecovery(),false);
 url=payment;page.emit('request',req());assert.equal(watch.snapshot().pending,true);
 assert.equal(JSON.stringify(watch.snapshot()).includes('not-for-report'),false);watch.stop();
});

test('only a long failed exact Payment GET permits one recovery, with listener cleanup',()=>{
 const page=new EventEmitter();page.url=()=>payment;let clock=0;
 const watch=watchMxEppPaymentRead(page,cfg,{now:()=>clock});
 for(const request of [req(api,'POST'),req(api.replace('/pymesmx/','/mx/')),req(api.replace('s2-smb','s1-smb')),req(api.replace('paymentmodes','checkout/update'))]){page.emit('request',request);clock+=60000;page.emit('requestfailed',request);assert.equal(watch.claimRecovery(),false);}
 const request=req();page.emit('request',request);assert.equal(watch.pending(),true);assert.equal(watch.claimRecovery(),false);
 clock+=61000;page.emit('requestfailed',request);assert.equal(watch.pending(),false);assert.equal(watch.claimRecovery(),true);assert.equal(watch.claimRecovery(),false);
 watch.stop();for(const event of ['request','response','requestfinished','requestfailed'])assert.equal(page.listenerCount(event),0);
});

for(const status of [200,403,500])test(`HTTP ${status} is never a transport-timeout recovery`,()=>{
 const page=new EventEmitter();page.url=()=>payment;let clock=0;
 const watch=watchMxEppPaymentRead(page,cfg,{now:()=>clock}),request=req();
 page.emit('request',request);page.emit('response',{request:()=>request,status:()=>status});clock=61000;page.emit('requestfailed',request);
 assert.equal(watch.claimRecovery(),false);watch.stop();
});

test('other markets, programmes, routes and short aborts never reload',()=>{
 for(const config of [{...cfg,market:'CL'},{...cfg,environment:'S1'},{...cfg,program:'other'},cfg]){
  const page=new EventEmitter();page.url=()=>config===cfg?new URL('cart',cfg.rootUrl).href:payment;
  const watch=watchMxEppPaymentRead(page,config,{now:()=>61000}),request=req();page.emit('request',request);page.emit('requestfailed',request);assert.equal(watch.claimRecovery(),false);watch.stop();
 }
 const page=new EventEmitter();page.url=()=>payment;let clock=0;
 const watch=watchMxEppPaymentRead(page,cfg,{now:()=>clock}),request=req();page.emit('request',request);clock=500;page.emit('requestfailed',request);assert.equal(watch.claimRecovery(),false);watch.stop();
});

test('a still-pending GET is never canceled by recovery',async()=>{
 const page=new EventEmitter();page.url=()=>payment;page.reload=()=>assert.fail('pending read must be preserved');
 const watch=watchMxEppPaymentRead(page,cfg);page.emit('request',req());
 assert.equal(await recoverMxEppPaymentRead(page,{},watch,{settleTimeoutMs:10}),false);watch.stop();
});
test('a replacement read that remains pending fails within its bound and is never reloaded again',async()=>{
 let reloaded=false,reloads=0;
 const page={reload:async()=>{reloaded=true;reloads++;}},offers={first:()=>({waitFor:async()=>{throw Error('Still loading');}})};
 const read={pending:()=>reloaded,claimRecovery:()=>true};
 assert.equal(await recoverMxEppPaymentRead(page,offers,read,{settleTimeoutMs:10}),false);
 assert.equal(reloads,1);
});

test('a failed native GET recovers through one browser navigation, without financial POSTs',async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});let watch;
 try{
  const page=await browser.newPage();let clock=0,reads=0;const methods=[];
  await page.route('**/*',async route=>{
   const request=route.request();methods.push(request.method());
   if(new URL(request.url()).origin+new URL(request.url()).pathname===api){reads++;if(reads===1){clock+=61000;return route.abort();}return route.fulfill({contentType:'application/json',body:'{}'});}
   return route.fulfill({contentType:'text/html',body:`<div id="payment">Loading</div><script>fetch('${api}').then(r=>{if(r.ok)document.querySelector('#payment').innerHTML='<button>Tarjeta de Crédito</button>'}).catch(()=>{});</script>`});
  });
  watch=watchMxEppPaymentRead(page,cfg,{now:()=>clock});await page.goto(payment);
  await expect.poll(()=>reads===1&&!watch.pending()).toBe(true);
  const offers=page.getByRole('button',{name:/Tarjeta/});
  assert.equal(await recoverMxEppPaymentRead(page,offers,watch),true);assert.equal(reads,2);
  assert.equal(await recoverMxEppPaymentRead(page,offers,watch),false);assert.equal(reads,2);
  assert.ok(methods.every(method=>method==='GET'));
 }finally{watch?.stop();await browser.close();}
});
test('recovery lets its replacement GET finish after the provider UI deadline without another reload',async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});let watch;
 try{
  const page=await browser.newPage();let clock=0,reads=0,reloads=0;const methods=[];
  await page.route('**/*',async route=>{
   methods.push(route.request().method());
   if(new URL(route.request().url()).origin+new URL(route.request().url()).pathname===api){
    if(++reads===1){clock+=61000;return route.abort();}
    await new Promise(resolve=>setTimeout(resolve,700));
    return route.fulfill({contentType:'application/json',body:'{}'});
   }
   return route.fulfill({contentType:'text/html',body:`<div id="payment">Loading</div><script>fetch('${api}').then(r=>{if(r.ok)document.querySelector('#payment').innerHTML='<button>Tarjeta de Crédito</button>'}).catch(()=>{});</script>`});
  });
  watch=watchMxEppPaymentRead(page,cfg,{now:()=>clock});await page.goto(payment);
  await expect.poll(()=>reads===1&&!watch.pending()).toBe(true);
  const reload=page.reload.bind(page);page.reload=async options=>{reloads++;return reload(options);};
  assert.equal(await recoverMxEppPaymentRead(page,page.getByRole('button',{name:/Tarjeta/}),watch,{providerTimeoutMs:100,settleTimeoutMs:3000,renderSettleTimeoutMs:3000}),true);
  assert.equal(reloads,1);assert.equal(reads,2);assert.ok(methods.every(method=>method==='GET'));
 }finally{watch?.stop();await browser.close();}
});
