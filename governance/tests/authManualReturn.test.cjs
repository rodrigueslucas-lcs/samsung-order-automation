const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForManualStorefront } = require('../../utils/authManualReturn.cjs');
const page = (url, ready = true) => ({ closed: false, address: url, ready,
  isClosed() { return this.closed; }, url() { return this.address; },
  getByRole() { return { isVisible: async () => this.ready }; },
});
for (const market of ['co', 'pe']) for (const hostname of ['stg.shop.samsung.com', 'stg2.shop.samsung.com']) {
  test(`${market} ${hostname} accepts existing home after Account popup closes, once hydrated`, async () => {
    const account = page('https://account.samsung.com/login');
    const home = page(`https://${hostname}/${market}/`, false);
    let clock = 0;
    const context = { pages: () => [account, home], browser: () => ({ isConnected: () => true }) };
    const result = await waitForManualStorefront(context, account, { hostname, market, timeout: 1000,
      now: () => clock, pause: async ms => { clock += ms; account.closed = true; home.ready = clock >= 500; },
    });
    assert.equal(result, home); assert.equal(clock, 500);
  });
}
test('an old signed-out home does not finish an active Account login', async () => {
  const account = page('https://account.samsung.com/login'), home = page('https://stg2.shop.samsung.com/co/');
  let clock=0;
  await assert.rejects(waitForManualStorefront({ pages: () => [account,home] },account,{
    hostname:'stg2.shop.samsung.com',market:'co',timeout:500,now:()=>clock,pause:async ms=>{clock+=ms;},
  }), error=>error.exitCode===79);
});
test('same-tab callback must finish at the correct rendered market home', async () => {
  const account=page('https://stg2.shop.samsung.com/co/login/return'); let clock=0;
  const result=await waitForManualStorefront({pages:()=>[account]},account,{
    hostname:'stg2.shop.samsung.com',market:'co',timeout:1000,now:()=>clock,
    pause:async ms=>{clock+=ms;account.address=clock===250?'https://stg2.shop.samsung.com/pe/':'https://stg2.shop.samsung.com/co/';},
  });
  assert.equal(result,account);assert.equal(clock,500);
});
test('browser loss remains classified instead of consuming the human deadline', async () => {
  await assert.rejects(waitForManualStorefront({pages:()=>[],browser:()=>({isConnected:()=>false})},page('about:blank'),{
    hostname:'stg2.shop.samsung.com',market:'co',timeout:500,
  }),error=>error.exitCode===75);
});
