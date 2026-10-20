const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthNavigation}=require('../../utils/authNavigation.cjs');

for(const market of ['mx','pe','co','cl'])test(`${market} recovers an aborted bootstrap once without leaking URL parameters`,async()=>{
  let calls=0;const warnings=[],pauses=[];const options={waitUntil:'domcontentloaded',timeout:60000};
  const result={ok:true};
  const page={isClosed:()=>false,goto:async(url,received)=>{
    assert.equal(received,options);calls++;
    if(calls===1)throw new Error('page.goto: net::ERR_ABORTED');
    return result;
  }};
  const go=createAuthNavigation(market,{prepareNavigation:async()=>{},pause:async ms=>pauses.push(ms),warn:m=>warnings.push(m)});
  assert.equal(await go(page,`https://stg2.shop.samsung.com/${market}/?code=SECRET&state=SECRET`,options),result);
  assert.equal(calls,2);assert.deepEqual(pauses,[1000]);assert.equal(warnings.length,1);
  assert.equal(warnings[0].includes('SECRET'),false);
});

for(const message of ['frame was detached','net::ERR_NETWORK_CHANGED'])test(`auth navigation recovers ${message}`,async()=>{
  let calls=0;
  const go=createAuthNavigation('co',{prepareNavigation:async()=>{},pause:async()=>{},warn:()=>{}});
  await go({isClosed:()=>false,goto:async()=>{if(++calls===1)throw Error(message);}},'https://stg.shop.samsung.com/getcookie.html');
  assert.equal(calls,2);
});

for(const scenario of [{message:'net::ERR_ABORTED',closed:false,expected:2},{message:'net::ERR_ABORTED',closed:true,expected:1},{message:'net::ERR_CERT_AUTHORITY_INVALID',closed:false,expected:1}])test(`auth navigation propagates persistent/fatal errors (${JSON.stringify(scenario)})`,async()=>{
  let calls=0;const error=Error(scenario.message);
  const go=createAuthNavigation('co',{prepareNavigation:async()=>{},pause:async()=>{},warn:()=>{}});
  await assert.rejects(go({isClosed:()=>scenario.closed,goto:async()=>{calls++;throw error;}},'https://stg2.shop.samsung.com/getcookie.html'),error);
  assert.equal(calls,scenario.expected);
});

for (const host of ['stg.shop.samsung.com','stg2.shop.samsung.com']) {
  for (const market of ['mx','pe','co','cl']) test(`${market} ${host} bypasses cached chunks before navigation without clearing identity`, async()=>{
    const events=[];
    const session={send:async(method,params)=>events.push({method,params})};
    const page={context:()=>({newCDPSession:async()=>session}),goto:async()=>events.push({method:'goto'})};
    const go=createAuthNavigation(market);
    await go(page,`https://${host}/getcookie.html`);
    await go(page,`https://${host}/${market}/`);
    assert.deepEqual(events,[{method:'Network.enable',params:undefined},
      {method:'Network.setCacheDisabled',params:{cacheDisabled:true}},
      {method:'goto'},{method:'goto'}]);
  });
}

test('cache policy does not attach to Samsung Account or production',async()=>{
  const go=createAuthNavigation('cl');let navigations=0;
  const page={context:()=>{throw Error('must not attach');},goto:async()=>navigations++};
  await go(page,'https://account.samsung.com/');
  await go(page,'https://www.samsung.com/cl/');
  assert.equal(navigations,2);
});

test('cache preparation failure propagates before navigation and permits a later recovery',async()=>{
  let attempts=0,navigations=0;
  const page={context:()=>({newCDPSession:async()=>({send:async()=>{if(++attempts===1)throw Error('CDP unavailable');}})}),goto:async()=>navigations++};
  const go=createAuthNavigation('cl');
  await assert.rejects(go(page,'https://stg2.shop.samsung.com/cl/'),/CDP unavailable/);
  assert.equal(navigations,0);
  await go(page,'https://stg2.shop.samsung.com/cl/');
  assert.equal(navigations,1);
});
