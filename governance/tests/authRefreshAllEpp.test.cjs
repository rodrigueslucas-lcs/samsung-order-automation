const test=require('node:test');
const assert=require('node:assert/strict');
const {PRIMARY_PROGRAMMES,MARKETS,buildEnvironment,main}=require('../../scripts/auth-refresh-all-epp.cjs');

test('EPP refresh-all selects only the four approved S2 market programmes',()=>{
  const original={ENVIRONMENT:'S1',CO_EPP_PROGRAM:'alianzas_co',EPP_PROGRAM:'wrong-global'};
  const env=buildEnvironment(original);
  assert.deepEqual(MARKETS,['MX','PE','CO','CL']);
  assert.equal(Object.keys(PRIMARY_PROGRAMMES).length,4);
  assert.equal(original.CO_EPP_PROGRAM,'alianzas_co');
  assert.equal(env.ENVIRONMENT,'S2');
  for(const market of MARKETS){
    assert.equal(env[market+'_QST_ENVIRONMENT'],'S2');
    assert.equal(env[market+'_EPP_PROGRAM'],PRIMARY_PROGRAMMES[market]);
  }
});

test('single command delegates to existing guarded refresh/publish logic once',async()=>{
  const calls=[];
  const code=await main({env:{ENVIRONMENT:'S1'},log:()=>{},run:async input=>{
    calls.push(input);
    return 2;
  }});
  assert.equal(code,2);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].argv,[
    '--environment=S2','--markets=MX,PE,CO,CL','--slot=primary',
    '--allow-refresh','--publish'
  ]);
  assert.equal(calls[0].env.CO_EPP_PROGRAM,'co_epp_agre');
});
