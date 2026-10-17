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
  const go=createAuthNavigation(market,{pause:async ms=>pauses.push(ms),warn:m=>warnings.push(m)});
  assert.equal(await go(page,`https://stg2.shop.samsung.com/${market}/?code=SECRET&state=SECRET`,options),result);
  assert.equal(calls,2);assert.deepEqual(pauses,[1000]);assert.equal(warnings.length,1);
  assert.equal(warnings[0].includes('SECRET'),false);
});

for(const message of ['frame was detached','net::ERR_NETWORK_CHANGED'])test(`auth navigation recovers ${message}`,async()=>{
  let calls=0;
  const go=createAuthNavigation('co',{pause:async()=>{},warn:()=>{}});
  await go({isClosed:()=>false,goto:async()=>{if(++calls===1)throw Error(message);}},'https://stg.shop.samsung.com/getcookie.html');
  assert.equal(calls,2);
});

for(const scenario of [{message:'net::ERR_ABORTED',closed:false,expected:2},{message:'net::ERR_ABORTED',closed:true,expected:1},{message:'net::ERR_CERT_AUTHORITY_INVALID',closed:false,expected:1}])test(`auth navigation propagates persistent/fatal errors (${JSON.stringify(scenario)})`,async()=>{
  let calls=0;const error=Error(scenario.message);
  const go=createAuthNavigation('co',{pause:async()=>{},warn:()=>{}});
  await assert.rejects(go({isClosed:()=>scenario.closed,goto:async()=>{calls++;throw error;}},'https://stg2.shop.samsung.com/getcookie.html'),error);
  assert.equal(calls,scenario.expected);
});
