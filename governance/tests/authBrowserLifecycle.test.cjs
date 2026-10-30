const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureAuthBrowser } = require('../../utils/authBrowserLifecycle.cjs');
const { authBrowserClosed } = require('../../utils/authBrowserLifecycle.cjs');
for(const [name,snapshot,expected] of [['absent',{known:true,profiles:[]},true],['live exact profile',{known:true,profiles:['/fixture/s2-mx-qa']},false],['unknown',{known:false,profiles:[]},false]])test(`OS browser probe fails closed: ${name}`,()=>{assert.equal(authBrowserClosed({market:'mx',environment:'S2',slot:'primary'},{platform:'win32',profilesRoot:'/fixture',canonical:value=>value.replaceAll('\\','/'),run:()=>JSON.stringify(snapshot)}),expected);});
const { refreshAuth } = require('../../utils/authRefreshRunner.cjs');

test('a stalled native EPP snapshot and disconnect cannot retain the profile lease indefinitely',async()=>{
  const root='https://stg2.shop.samsung.com/mx/multistore/program/program/';
  const never=()=>new Promise(()=>{});
  const h=await captureAuthBrowser({market:'mx',environment:'S2',slot:'primary'},{
    profilesRoot:'/fixture/epp',readFile:()=> '43210\n/devtools/browser/fixture-id',snapshotTimeoutMs:15,disconnectTimeoutMs:15,
    chromium:{connectOverCDP:async()=>({contexts:()=>[{pages:()=>[{url:()=>root,evaluate:never}],cookies:never}],close:never})},
  });
  await assert.rejects(h.readEppSnapshot(root),e=>e.code==='EPP_NATIVE_SNAPSHOT_TIMEOUT');
  await h.dispose();
});

test('EPP native readback rejects Production/Base Store and preserves an active Account gate',async()=>{
  let pages=[{url:()=> 'https://account.samsung.com/iam/oauth2/authorize'}],reads=0;
  const h=await captureAuthBrowser({market:'mx',environment:'S2',slot:'primary'},{profilesRoot:'/fixture/epp',readFile:()=> '43210\n/devtools/browser/fixture-id',chromium:{connectOverCDP:async()=>({contexts:()=>[{pages:()=>pages,cookies:async()=>{reads++;return[];},storageState:async()=>assert.fail('must not visit other stored origins')}],close:async()=>{}})}});
  await assert.rejects(h.readEppSnapshot('https://www.samsung.com/mx/multistore/program/program/'),/staging EPP/);
  await assert.rejects(h.readEppSnapshot('https://stg2.shop.samsung.com/mx/'),/staging EPP/);
  const root='https://stg2.shop.samsung.com/mx/multistore/program/program/';
  assert.equal(await h.readEppSnapshot(root),null);assert.equal(reads,0);
  pages=[{url:()=>root,evaluate:async()=>({localStorage:[],sessionStorage:{fixture:'private-fixture'}})}];
  const snapshot=await h.readEppSnapshot(root);assert.deepEqual(snapshot.sessionStorage,{fixture:'private-fixture'});assert.equal(snapshot.storageState.origins[0].origin,'https://stg2.shop.samsung.com');assert.equal(reads,1);await h.dispose();
});

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} captures exact dedicated browser, never a shared CDP port`, async () => {
    const events = [];
    const handle = await captureAuthBrowser({ market, environment, slot: 'second' }, {
      profilesRoot: '/fixture', readFile(file) { assert.ok(file.includes(`${environment.toLowerCase()}-${market}-second`)); return '43210\n/devtools/browser/fixture-id\n'; },
      chromium: { async connectOverCDP(endpoint) {
        assert.equal(endpoint, 'ws://127.0.0.1:43210/devtools/browser/fixture-id');
        return { isConnected: () => true, async newBrowserCDPSession() { return { async send(command) { events.push(command); } }; }, async close() { events.push('disconnect'); } };
      } },
    });
    assert.deepEqual(events, []);
    await handle.closeVerified(); await handle.dispose();
    assert.deepEqual(events, ['Browser.close', 'disconnect']);
  });
}

for (const failurePhase of [null, 'verify', 'package', 'publish']) {
  test(`browser closes only after every phase succeeds (${failurePhase || 'success'})`, async () => {
    const events = [];
    const pending = refreshAuth({ market: 'pe', environment: 'S2', env: { JENKINS_AUTH_PUBLISH: '1' }, publishScript: 'scripts/publish.cjs' }, {
      acquireMarket: () => () => {}, acquire: () => () => events.push('release'), log() {},
      async runChild(script) { const phase = script.match(/auth-(login|verify|package)/)?.[1] || 'publish'; events.push(phase); return phase === failurePhase ? 1 : 0; },
      async captureBrowser() { events.push('capture'); return { async closeVerified() { events.push('close'); }, async dispose() { events.push('disconnect'); } }; },
    });
    if (failurePhase) await assert.rejects(pending); else await pending;
    assert.equal(events.includes('close'), !failurePhase);
    if (!failurePhase) assert.ok(events.indexOf('close') > events.indexOf('publish'));
    assert.deepEqual(events.slice(-2), ['disconnect', 'release']);
  });
}

test('shared PreQA2 login does not capture or close any native browser', async () => {
  await refreshAuth({ market: 'co', environment: 'S2', env: { CO_STOREFRONT_URL: 'https://p6-pre-qa2.samsung.com/co/' } }, {
    acquireMarket: () => () => {}, acquire: () => () => {}, log() {}, runChild: async () => 0,
    captureBrowser() { throw new Error('must preserve shared Chrome'); },
  });
});
