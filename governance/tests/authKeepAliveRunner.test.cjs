const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyIdentity, recoverIdentity, packageAndPublishMarket, runKeepAliveCycle, identityEnv } = require('../../utils/authKeepAliveRunner.cjs');
const quiet = () => {};
const id = { market: 'mx', environment: 'S2', slot: 'primary', env: {} };
function cycleFixture(status = 'HEALTHY') {
  const calls = [], saved = new Map();
  const deps = {
    acquireMarket(market) { calls.push('lease:' + market); const release = () => calls.push('release:' + market); release.env = {}; return release; },
    hash: () => 'before', readState: market => saved.get(market) || {}, saveState: (market, env, state) => saved.set(market, state), log: quiet,
    verify: async identity => { calls.push(`verify:${identity.market}:${identity.slot}`); return { ...identity, env: undefined, status }; },
    recover: async identity => { calls.push(`refresh:${identity.market}:${identity.slot}`); return { ...identity, env: undefined, status: 'RECOVERED' }; },
    resume: async identity => { calls.push(`resume:${identity.market}:${identity.slot}`); return {market:identity.market,environment:identity.environment,slot:identity.slot,status:'HUMAN_REQUIRED'}; },
    captureBrowser: async()=>null,
    finalize: async ({ market }) => { calls.push('finalize:' + market); return { market, status: 'READY', published: false }; },
  };
  return { calls, deps, saved };
}
test('all six HEALTHY identities verify in parallel without login, package each market and release leases last', async () => {
  const s = cycleFixture(); const result = await runKeepAliveCycle({}, s.deps);
  assert.equal(result.ok, true); assert.equal(result.identities.length, 6); assert.equal(result.finalized.length, 4);
  assert.ok(!s.calls.some(c => c.startsWith('refresh:')));
  for (const market of ['mx','pe','co','cl']) assert.ok(s.calls.indexOf('release:' + market) > s.calls.indexOf('finalize:' + market));
  assert.ok(!s.calls.includes('verify:pe:second')); assert.ok(!s.calls.includes('verify:cl:second'));
});
for (const [codes, expected, attempts] of [[[0], 'HEALTHY', 1], [[20,0], 'HEALTHY',2], [[20,20],'NEEDS_REFRESH',2], [[21,21],'TRANSIENT_ERROR',2], [[20,21],'UNPROVEN',2], [[1,1],'UNPROVEN',2]]) {
  test(`strict verifies ${codes.join('/')} produce ${expected}`, async () => {
    const sequence = [...codes], calls = []; let released = false;
    const result = await verifyIdentity(id, { acquire: () => () => { released = true; }, runScript: async (script, env) => { calls.push(env); return { code: sequence.shift(), audit: {accountPages:0,statePersisted:true} }; }, log: quiet, pause: async () => {} });
    assert.equal(result.status, expected); assert.equal(calls.length, attempts); assert.equal(released, true);
    assert.equal(calls[0].MX_AUTH_AUTO_RENEW, '0'); assert.equal(calls[0].REGISTERED_AUTH_REHYDRATE, '0'); assert.equal(calls[0].JENKINS_AUTH_PUBLISH, '0');
  });
}
test('existing identity lock is BUSY and no verifier starts', async () => {
  const result = await verifyIdentity(id, { acquire() { throw new Error('refresh is already active'); }, runScript() { throw new Error('must not start'); } });
  assert.equal(result.status, 'BUSY');
});
for (const [code, expected] of [[0,'RECOVERED'],[2,'HUMAN_REQUIRED'],[1,'FAILED'],[3,'BUSY']]) test(`refresh exit ${code} produces ${expected}`, async () => {
  const result = await recoverIdentity(id, { runScript: async (script, env) => { assert.equal(env.JENKINS_AUTH_PUBLISH, '0'); assert.equal(env.AUTH_KEEPALIVE, undefined); return { code }; }, log: quiet });
  assert.equal(result.status, expected);
});
test('two positive invalid checks trigger only the affected identity refresh', async () => {
  const s = cycleFixture(); s.deps.verify = async identity => ({ ...identity, status: identity.market === 'co' && identity.slot === 'second' ? 'NEEDS_REFRESH' : 'HEALTHY' });
  const result = await runKeepAliveCycle({}, s.deps);
  assert.equal(result.ok, true); assert.deepEqual(s.calls.filter(c => c.startsWith('refresh:')), ['refresh:co:second']);
});
for (const status of ['HUMAN_REQUIRED','FAILED','BUSY']) test(`${status} recovery blocks only its market`, async () => {
  const s = cycleFixture(); s.deps.verify = async identity => ({ ...identity, status: identity.market === 'mx' ? 'NEEDS_REFRESH' : 'HEALTHY' });
  s.deps.recover = async identity => ({ ...identity, status });
  const result = await runKeepAliveCycle({}, s.deps);
  assert.equal(result.ok, false); assert.equal(result.finalized.filter(r => r.status === 'READY').length, 3);
});
test('pending human verification is not restarted by the next scheduled cycle', async () => {
  const s = cycleFixture('NEEDS_REFRESH'); s.deps.readState = () => ({ human: { primary: true, second: true } });
  const result = await runKeepAliveCycle({}, s.deps);
  assert.ok(result.identities.filter(r=>r.slot==='primary').every(r => r.status === 'HUMAN_REQUIRED'));
  assert.ok(result.identities.filter(r=>r.slot==='second').every(r => r.status === 'WAITING_PRIMARY'));
  assert.ok(!s.calls.some(c => c.startsWith('refresh:')));assert.ok(!s.calls.some(c=>c.includes('resume:')&&c.endsWith(':second')));
});
test('healthy verification clears a previous human gate without login', async () => {
  const s = cycleFixture(); s.deps.readState = () => ({ human: { primary: true, second: true } }); await runKeepAliveCycle({}, s.deps);
  assert.deepEqual(s.saved.get('mx').human, {});
});
test('one thrown verification or finalization does not cancel sibling markets', async () => {
  const s = cycleFixture(); s.deps.verify = async identity => { if (identity.market === 'pe') throw new Error('fixture-only'); return { ...identity, status: 'HEALTHY' }; };
  const result = await runKeepAliveCycle({}, s.deps); assert.equal(result.ok, false); assert.equal(result.finalized.filter(r => r.status === 'READY').length, 3);
});
test('market BUSY is not reported as READY and never verifies its profiles', async () => {
  const s = cycleFixture(); const acquire = s.deps.acquireMarket;
  s.deps.acquireMarket = market => { if (market === 'mx') throw Object.assign(new Error('busy'), {code:'AUTH_BUSY'}); return acquire(market); };
  const result = await runKeepAliveCycle({}, s.deps);
  assert.equal(result.ok, false); assert.equal(result.busy.length, 2); assert.ok(!s.calls.includes('verify:mx:primary')); assert.equal(result.finalized.filter(r => r.status === 'READY').length, 3);
});
for (const market of ['mx','co']) for (const environment of ['S1','S2']) test(`${market} ${environment} SECOND stays isolated`, () => {
  const env = identityEnv(market, environment, 'second', { MX_AUTH_SLOT: 'primary', [`${market.toUpperCase()}_AUTH_AUTO_RENEW`]:'1' });
  assert.equal(env[`${market.toUpperCase()}_AUTH_SLOT`], 'second'); assert.equal(env[`${market.toUpperCase()}_AUTH_AUTO_RENEW`], '0');
  if (market === 'co') assert.equal(env.MX_AUTH_SLOT, undefined);
});
for (const market of ['pe','cl']) test(`${market} rejects SECOND`, () => assert.throws(() => identityEnv(market, 'S2', 'second')));
function finalFixture({ same = true, packageCode = 0, publishCode = 0 } = {}) {
  const calls = [], saves = [];
  return { calls, saves, options: { market:'mx', environment:'S2', publish:true, env:{}, state:{publishedContentHash:same?'content':'old'}, beforeHash:'file-before' },
    deps: { runScript: async script => { calls.push(script); return {code:script.includes('package')?packageCode:publishCode}; }, hash:()=> 'file-after', contentHash:()=> 'content', save:(...args)=>saves.push(args), log:quiet } };
}
test('identical session hash never republishes despite bookkeeping/file hash differences', async () => {
  const s=finalFixture(); const r=await packageAndPublishMarket(s.options,s.deps); assert.equal(r.status,'READY'); assert.equal(r.published,false); assert.equal(s.calls.length,1); assert.equal(s.saves.length,0);
});
test('changed session publishes once and checkpoints only after success', async () => {
  const s=finalFixture({same:false}); const r=await packageAndPublishMarket(s.options,s.deps); assert.equal(r.published,true); assert.equal(s.calls.length,2); assert.equal(s.saves[0][2].publishedContentHash,'content');
});
test('package failure cannot publish', async () => { const s=finalFixture({same:false,packageCode:1}); const r=await packageAndPublishMarket(s.options,s.deps); assert.equal(r.status,'PACKAGE_FAILED'); assert.equal(s.calls.length,1); });
test('failed publication is retried next cycle even when the local bundle no longer changes', async () => {
  const s=finalFixture({same:false,publishCode:1}); const first=await packageAndPublishMarket(s.options,s.deps); assert.equal(first.status,'PUBLISH_FAILED'); assert.equal(s.saves.length,0);
  s.deps.runScript=async script=>{s.calls.push(script);return {code:0};}; s.options.beforeHash='file-after'; const next=await packageAndPublishMarket(s.options,s.deps); assert.equal(next.changed,false); assert.equal(next.published,true);
});
test('package performed inside refresh cannot hide pending publication', async () => { const s=finalFixture({same:false}); s.options.beforeHash='file-after'; const r=await packageAndPublishMarket(s.options,s.deps); assert.equal(r.changed,false); assert.equal(r.published,true); });
test('disabled publishing does not acknowledge the bundle as sent', async () => { const s=finalFixture({same:false}); s.options.publish=false; const r=await packageAndPublishMarket(s.options,s.deps); assert.equal(r.published,false); assert.equal(s.saves.length,0); });

test('explicit CL/PE scope never verifies, recovers, packages or leases MX/CO', async () => {
  const s=cycleFixture();const result=await runKeepAliveCycle({markets:['cl','pe']},s.deps);
  assert.equal(result.ok,true);assert.deepEqual(result.identities.map(r=>r.market).sort(),['cl','pe']);
  assert.ok(s.calls.every(c=>!/:mx(?::|$)|:co(?::|$)/.test(c)));
});
for(const audit of [undefined,{accountPages:1,statePersisted:true},{accountPages:0,statePersisted:false}])test('zero exit without strict audit cannot masquerade as HEALTHY '+JSON.stringify(audit),async()=>{const result=await verifyIdentity(id,{acquire:()=>()=>{},runScript:async()=>({code:0,audit}),pause:async()=>{},log:quiet});assert.equal(result.status,'UNPROVEN');});
test('parallelism is bounded while queued operations are preserved after errors',async()=>{const {limitConcurrency}=require('../../utils/authKeepAliveRunner.cjs');const lane=limitConcurrency(2);let active=0,peak=0,finished=0;const results=await Promise.allSettled(Array.from({length:6},(_,i)=>lane(async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,5));if(i===1)throw Error('fixture');finished++;}finally{active--;}})));assert.equal(peak,2);assert.equal(finished,5);assert.equal(results.filter(r=>r.status==='rejected').length,1);});
test('all FIRST recoveries finish before any SECOND login begins',async()=>{const s=cycleFixture('NEEDS_REFRESH');let primary=0;s.deps.recover=async identity=>{if(identity.slot==='second')assert.equal(primary,4);else primary++;return {...identity,status:'RECOVERED'};};const result=await runKeepAliveCycle({},s.deps);assert.equal(result.ok,true);});
test('pending FIRST human gate defers SECOND login windows',async()=>{const s=cycleFixture('NEEDS_REFRESH');s.deps.recover=async identity=>{assert.equal(identity.slot,'primary');return {...identity,status:'HUMAN_REQUIRED'};};const result=await runKeepAliveCycle({},s.deps);assert.equal(result.identities.filter(r=>r.status==='WAITING_PRIMARY').length,2);});
for(const market of ['mx','pe','co','cl'])for(const environment of ['S1','S2'])test(`${market} ${environment} human wait retains ten minutes for password continuation after CAPTCHA`,async()=>{await recoverIdentity({market,environment,slot:'primary',env:{}},{runScript:async(_script,env,options)=>{assert.equal(env[market.toUpperCase()+'_AUTH_INTERACTIVE_TIMEOUT_MS'],'600000');assert.equal(options.timeoutMs,900000);return{code:2,handoff:{passwordAttempted:false,emailPhase:'CHALLENGE'}};},log(){}});});

test('completed child handoff audit is persisted before another market finishes its human wait',async()=>{const s=cycleFixture('NEEDS_REFRESH');let finish;const waiting=new Promise(resolve=>finish=resolve);s.deps.recover=async(identity,{onEvent})=>{onEvent({market:identity.market,slot:identity.slot,status:'HUMAN_REQUIRED'});if(identity.market==='cl')await waiting;return {...identity,env:undefined,status:'FAILED',humanPending:true,passwordAttempted:false,emailPhase:'CHALLENGE'};};const running=runKeepAliveCycle({markets:['pe','cl']},s.deps);try{await new Promise(resolve=>setImmediate(resolve));assert.equal(s.saved.get('pe').handoff.primary.passwordAttempted,false);assert.equal(s.saved.get('pe').handoff.primary.emailPhase,'CHALLENGE');}finally{finish();await running;}});
