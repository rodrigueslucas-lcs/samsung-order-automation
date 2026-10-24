const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeAccountLogin } = require('../../utils/authAccountLogin.cjs');

function scenario({ initial = 'email', captcha = false, remainCaptcha = false, market = 'pe', hostname = 'stg2.shop.samsung.com', warm = false } = {}) {
  let state = initial, clock = 0, url = warm ? `https://${hostname}/${market}/` : 'https://account.samsung.com/accounts/fixture';
  const calls = [], logs = [];
  const locator = visible => ({ filter() { return this; }, first() { return this; }, last() { return this; },
    evaluateAll: async () => false, isVisible: async () => visible(), count: async () => Number(visible()), fill: async () => calls.push('fill-' + state),
    click: async () => { calls.push('click-' + state); if (state === 'email') state = captcha ? 'captcha' : 'password'; else url = `https://${hostname}/${market}/`; } });
  const page = { isClosed: () => false, url: () => url,
    locator: selector => selector.includes('iframe') ? locator(() => state === 'captcha') : locator(() => state === (selector.includes('password') ? 'password' : 'email')),
    getByText: () => locator(() => false), getByRole: () => locator(() => true),
  };
  const run = () => completeAccountLogin(page, { market, hostname, credentials: { email: 'fixture@example.test', password: 'fixture-only' },
    timeout: 1000, now: () => clock, pause: async ms => { clock += ms; if (state === 'captcha' && !remainCaptcha && clock >= 500) state = 'password'; }, log: line => logs.push(line) });
  return { run, calls, logs };
}

for (const market of ['mx', 'pe', 'co', 'cl']) for (const hostname of ['stg.shop.samsung.com', 'stg2.shop.samsung.com']) {
  test(`${market} ${hostname} submits email and password once then hands off to auth verification`, async () => {
    const s = scenario({ market, hostname }); await s.run();
    assert.deepEqual(s.calls, ['fill-email', 'click-email', 'fill-password', 'click-password']);
    assert.ok(s.logs.every(line => !/fixture-only|fixture@example/.test(line)));
  });
}

test('resuming at password does not send the email step again', async () => {
  const s = scenario({ initial: 'password' }); await s.run();
  assert.deepEqual(s.calls, ['fill-password', 'click-password']);
});
test('CAPTCHA waits for human completion without another email or Next click', async () => {
  const s = scenario({ captcha: true }); await s.run();
  assert.deepEqual(s.calls, ['fill-email', 'click-email', 'fill-password', 'click-password']);
  assert.ok(s.logs.some(line => /human completion/.test(line)));
});
test('unresolved human verification is typed and never resubmits credentials', async () => {
  const s = scenario({ initial: 'captcha', remainCaptcha: true });
  await assert.rejects(s.run(), error => error.exitCode === 79);
  assert.deepEqual(s.calls, []);
});

test('visible CAPTCHA fills only email and leaves password/submission for after human completion', async () => {
  let fills = 0, clock = 0;
  const locator = visible => ({ filter() { return this; }, first() { return this; }, last() { return this; },
    evaluateAll: async () => false, count: async () => Number(visible), isVisible: async () => visible, fill: async () => { fills++; } });
  const page = { isClosed: () => false, url: () => 'https://account.samsung.com/accounts/fixture',
    locator: selector => locator(selector.includes('iframe') ? selector.includes('[title="reCAPTCHA" i]') : true),
    getByText: () => locator(false),
  };
  await assert.rejects(completeAccountLogin(page, { market: 'cl', hostname: 'stg2.shop.samsung.com',
    credentials: { email: 'fixture@example.test', password: 'fixture-only' }, timeout: 1000, now: () => clock, pause: async ms => { clock += ms; }, log() {},
  }), error => error.exitCode === 79);
  assert.equal(fills, 1);
});

test('provider blank transition waits without filling credentials on the blank document', async () => {
  let clock = 0;
  const locator = { filter() { return this; }, first() { return this; } };
  await completeAccountLogin({ isClosed: () => false, url: () => clock < 500 ? 'about:blank' : 'https://stg2.shop.samsung.com/pe/', locator: () => locator }, {
    market: 'pe', hostname: 'stg2.shop.samsung.com', credentials() { throw new Error('must not resolve credentials'); },
    timeout: 1000, now: () => clock, pause: async ms => { clock += ms; }, log() {},
  });
  assert.equal(clock, 500);
});
test('warm SSO does not attempt to find or fill an obsolete provider field', async () => {
  const s = scenario({ warm: true }); await s.run(); assert.deepEqual(s.calls, []);
});
test('insecure or foreign targets never receive credentials', async () => {
  let fills = 0;
  for (const url of ['http://account.samsung.com/accounts', 'https://foreign.example/accounts']) {
    const locator = { filter() { return this; }, first() { return this; }, fill: async () => fills++ };
    await assert.rejects(completeAccountLogin({ isClosed: () => false, url: () => url, locator: () => locator }, {
      market: 'pe', hostname: 'stg2.shop.samsung.com', credentials: {}, log() {},
    }));
  }
  assert.equal(fills, 0);
});

test('MFA never receives saved credentials even when it renders a password input', async () => {
  let clock = 0;
  const loc = { filter() { return this; }, first() { return this; }, isVisible: async () => true, count: async () => 0, fill() { throw new Error('MFA must remain manual'); } };
  await assert.rejects(completeAccountLogin({ isClosed: () => false, url: () => 'https://account.samsung.com/accounts/fixture', locator: () => loc, getByText: () => loc }, {
    market: 'mx', hostname: 'stg2.shop.samsung.com', credentials() { throw new Error('must not resolve credentials'); }, timeout: 1000, now: () => clock, pause: async ms => { clock += ms; }, log() {},
  }), error => error.exitCode === 79);
});

test('combined login form fills email before password and submits only once', async () => {
  let returned = false;
  const actions = [];
  const loc = name => ({ filter() { return this; }, first() { return this; }, last() { return this; }, isVisible: async () => true, count: async () => 0, fill: async () => actions.push(name), click: async () => { actions.push('submit'); returned = true; } });
  await completeAccountLogin({ isClosed: () => false, url: () => returned ? 'https://stg.shop.samsung.com/co/' : 'https://account.samsung.com/accounts/fixture', locator: s => loc(s.includes('password') ? 'password' : 'email'), getByText: () => ({first() {return this;}, isVisible: async () => false}), getByRole: () => loc('button') }, {
    market: 'co', hostname: 'stg.shop.samsung.com', credentials: {email: 'fixture@example.test', password: 'fixture-only'}, pause: async () => {}, log() {},
  });
  assert.deepEqual(actions, ['email', 'password', 'submit']);
});
test('checkbox is clicked once, password waits for manual completion even when the frame remains visible',async()=>{let clock=0,returned=false,completed=false;const actions=[];const loc=name=>({filter(){return this;},first(){return this;},last(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>completed,fill:async()=>actions.push(name),click:async()=>{actions.push('submit');returned=true;}});const page={isClosed:()=>false,url:()=>returned?'https://stg2.shop.samsung.com/cl/':'https://account.samsung.com/accounts/fixture',locator:s=>loc(s.includes('password')?'password':'email'),getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole:()=>loc('button'),frameLocator:()=>({first(){return this;},getByRole:()=>({isVisible:async()=>true,click:async()=>actions.push('checkbox')})})};await completeAccountLogin(page,{market:'cl',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture'},timeout:2000,now:()=>clock,pause:async ms=>{clock+=ms;if(clock>=500)completed=true;},log(){}});assert.deepEqual(actions,['email','checkbox','password','submit']);});

test('a late checkbox is awaited passively and clicked exactly once',async()=>{let clock=0,returned=false,clicked=false,completed=false;const actions=[];const loc=name=>({filter(){return this;},first(){return this;},last(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>completed,fill:async()=>actions.push(name),click:async()=>{actions.push('submit');returned=true;}});const page={isClosed:()=>false,url:()=>returned?'https://stg2.shop.samsung.com/cl/':'https://account.samsung.com/accounts/fixture',locator:s=>loc(s.includes('password')?'password':'email'),getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole:()=>loc('button'),frameLocator:()=>({first(){return this;},getByRole:()=>({isVisible:async()=>clock>=500,click:async()=>{clicked=true;actions.push('checkbox');}})})};await completeAccountLogin(page,{market:'cl',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture'},timeout:2500,now:()=>clock,pause:async ms=>{clock+=ms;if(clicked&&clock>=1000)completed=true;},log(){}});assert.deepEqual(actions,['email','checkbox','password','submit']);});
