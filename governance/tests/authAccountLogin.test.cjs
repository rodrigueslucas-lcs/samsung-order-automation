const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeAccountLogin } = require('../../utils/authAccountLogin.cjs');

function scenario({ initial = 'email', captcha = false, remainCaptcha = false, market = 'pe', hostname = 'stg2.shop.samsung.com', warm = false, lateEmail = false, latePassword = false } = {}) {
  let state = initial, clock = 0, url = warm ? `https://${hostname}/${market}/` : 'https://account.samsung.com/accounts/fixture';
  const calls = [], logs = [];
  let emailChecks = 0, passwordChecks = 0;
  const locator = visible => ({ filter() { return this; }, first() { return this; }, last() { return this; },
    evaluateAll: async () => false, isVisible: async () => visible(), count: async () => Number(visible()), fill: async () => calls.push('fill-' + state),
    click: async () => { assert.ok(calls.includes('fill-' + state), 'credential field must be populated before submit'); calls.push('click-' + state); if (state === 'email') state = captcha ? 'captcha' : 'password'; else url = `https://${hostname}/${market}/`; } });
  const page = { isClosed: () => false, url: () => url,
    locator: selector => selector.includes('iframe') ? locator(() => state === 'captcha') : locator(() => {
      const kind = selector.includes('password') ? 'password' : 'email';
      if (state !== kind) return false;
      if (kind === 'email' && lateEmail && emailChecks++ === 0) return false;
      if (kind === 'password' && latePassword && passwordChecks++ === 0) return false;
      return true;
    }),
    getByText: () => locator(() => false), getByRole: () => locator(() => true),
  };
  const run = () => completeAccountLogin(page, { market, hostname, credentials: { email: 'fixture@example.test', password: 'fixture-only' },
    timeout: 2000, now: () => clock, pause: async ms => { clock += ms; if (state === 'captcha' && !remainCaptcha && clock >= 500) state = 'password'; }, log: line => logs.push(line) });
  return { run, calls, logs };
}

for (const market of ['mx', 'pe', 'co', 'cl']) for (const hostname of ['stg.shop.samsung.com', 'stg2.shop.samsung.com']) {
  test(`${market} ${hostname} late-rendered fields are filled before either submit`, async () => {
    const s = scenario({ market, hostname, lateEmail: true, latePassword: true }); await s.run();
    assert.deepEqual(s.calls, ['fill-email', 'click-email', 'fill-password', 'click-password']);
  });
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

test('an expired Samsung authorization error fails immediately without another credential action', async () => {
  const locator = { filter() { return this; }, first() { return this; } };
  await assert.rejects(completeAccountLogin({
    isClosed: () => false, url: () => 'https://account.samsung.com/iam/error/authorize', locator: () => locator,
  }, { market: 'pe', hostname: 'stg2.shop.samsung.com',
    credentials() { assert.fail('error page must not resolve credentials'); },
    pause() { assert.fail('error page must not enter the human wait loop'); }, log() {},
  }), error => error.code === 'AUTH_PROVIDER_ERROR' && error.exitCode === 78);
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
test('checkbox is clicked once, password waits for manual completion even when the frame remains visible',async()=>{let clock=0,returned=false,completed=false;const actions=[];const loc=name=>({filter(){return this;},first(){return this;},last(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>completed,inputValue:async()=>'fixture@example.test',fill:async()=>actions.push(name),click:async()=>{actions.push('submit');returned=true;}});const page={isClosed:()=>false,url:()=>returned?'https://stg2.shop.samsung.com/cl/':'https://account.samsung.com/accounts/fixture',locator:s=>s.startsWith('iframe[title*="challenge"')?{filter(){return this;},count:async()=>0}:loc(s.includes('password')?'password':'email'),getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole:()=>loc('button'),frameLocator:()=>({first(){return this;},getByRole:()=>({getAttribute:async()=>completed?'true':'false',isVisible:async()=>true,click:async()=>actions.push('checkbox')})})};await completeAccountLogin(page,{market:'cl',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture'},timeout:2000,now:()=>clock,pause:async ms=>{clock+=ms;if(clock>=500)completed=true;},log(){}});assert.deepEqual(actions,['email','checkbox','password','submit']);});

test('a late checkbox is awaited passively and clicked exactly once',async()=>{let clock=0,returned=false,clicked=false,completed=false;const actions=[];const loc=name=>({filter(){return this;},first(){return this;},last(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>completed,inputValue:async()=>'fixture@example.test',fill:async()=>actions.push(name),click:async()=>{actions.push('submit');returned=true;}});const page={isClosed:()=>false,url:()=>returned?'https://stg2.shop.samsung.com/cl/':'https://account.samsung.com/accounts/fixture',locator:s=>s.startsWith('iframe[title*="challenge"')?{filter(){return this;},count:async()=>0}:loc(s.includes('password')?'password':'email'),getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole:()=>loc('button'),frameLocator:()=>({first(){return this;},getByRole:()=>({getAttribute:async()=>completed?'true':'false',isVisible:async()=>clock>=500,click:async()=>{clicked=true;actions.push('checkbox');}})})};await completeAccountLogin(page,{market:'cl',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture'},timeout:2500,now:()=>clock,pause:async ms=>{clock+=ms;if(clicked&&clock>=1000)completed=true;},log(){}});assert.deepEqual(actions,['email','checkbox','password','submit']);});

test('a visible visual challenge wins over a stale completed token from another widget',async()=>{let clock=0;const actions=[];const loc={filter(){return this;},first(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>true,fill:async()=>actions.push('email')};await assert.rejects(completeAccountLogin({isClosed:()=>false,url:()=> 'https://account.samsung.com/iam/oauth2/authorize',locator:()=>loc,getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole(){throw Error('must not submit under challenge');},frameLocator(){throw Error('must not click while visual challenge is active');}},{market:'co',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'secret-fixture'},timeout:1000,now:()=>clock,pause:async ms=>{clock+=ms;},log(){}}),e=>e.exitCode===79);assert.deepEqual(actions,['email']);});

test('hidden widget response cannot release an unchecked visible checkbox',async()=>{let clock=0;const actions=[];const loc=name=>({filter(){return this;},first(){return this;},isVisible:async()=>true,count:async()=>1,evaluateAll:async()=>true,fill:async()=>actions.push(name)});const page={isClosed:()=>false,url:()=> 'https://account.samsung.com/iam/oauth2/authorize',locator:s=>s.startsWith('iframe[title*="challenge"')?{filter(){return this;},count:async()=>0}:loc(s.includes('password')?'password':'email'),getByText:()=>({first(){return this;},isVisible:async()=>false}),getByRole(){throw Error('must not submit');},frameLocator:s=>{assert.match(s,/:visible/);return{first(){return this;},getByRole:()=>({getAttribute:async()=> 'false',isVisible:async()=>true,click:async()=>actions.push('checkbox')})};}};await assert.rejects(completeAccountLogin(page,{market:'co',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'secret-fixture'},timeout:1000,now:()=>clock,pause:async ms=>{clock+=ms;},log(){}}),e=>e.exitCode===79);assert.deepEqual(actions,['email','checkbox']);});

test('email replaced after CAPTCHA advances to password instead of waiting on the stale email locator',async()=>{let state='email',clock=0,url='https://account.samsung.com/accounts/fixture';const calls=[];const loc=(visible,extra={})=>({filter(){return this;},first(){return this;},last(){return this;},isVisible:async()=>visible(),count:async()=>Number(visible()),...extra});const email=loc(()=>state==='email',{fill:async()=>calls.push('email-fill'),inputValue:async options=>{assert.equal(options.timeout,1500);state='password';throw Object.assign(new Error('fixture replaced email'),{name:'TimeoutError'});}});const password=loc(()=>state==='password',{fill:async()=>calls.push('password-fill')});const page={isClosed:()=>false,url:()=>url,locator:selector=>selector.includes('iframe')?loc(()=>state==='captcha'):selector.includes('password')?password:email,getByText:()=>loc(()=>false),getByRole:()=>loc(()=>true,{click:async()=>{if(state==='email'){calls.push('next');state='captcha';}else{calls.push('sign-in');url='https://stg2.shop.samsung.com/cl/';}}})};await completeAccountLogin(page,{market:'cl',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture-only'},timeout:5000,now:()=>clock,pause:async ms=>{clock+=ms;if(state==='captcha'&&clock>=500)state='email';},log(){}});assert.deepEqual(calls,['email-fill','next','password-fill','sign-in']);});

test('a new refresh discards only positively rejected official authorization pages', async () => {
  const {discardRejectedAccountPages}=require('../../utils/authAccountLogin.cjs');
  const page=url=>({closed:false,url:()=>url,isClosed(){return this.closed},async close(){this.closed=true}});
  const rejected=page('https://account.samsung.com/iam/error/authorize');
  const live=page('https://account.samsung.com/iam/oauth2/authorize');
  const foreign=page('https://foreign.example/iam/error/authorize');
  const pages=[rejected,live,foreign];
  const count=await discardRejectedAccountPages({pages:()=>pages,newPage(){assert.fail('other tabs keep Chrome alive')}});
  assert.equal(count,1);assert.equal(rejected.closed,true);assert.equal(live.closed,false);assert.equal(foreign.closed,false);
});

test('discarding the sole rejected tab preserves the dedicated Chrome for fresh storefront authorization', async () => {
  const {discardRejectedAccountPages}=require('../../utils/authAccountLogin.cjs');
  const pages=[];const rejected={closed:false,url:()=> 'https://account.samsung.com/iam/error/authorize',isClosed(){return this.closed},async close(){assert.equal(pages.length,2);this.closed=true}};pages.push(rejected);
  let created=0;await discardRejectedAccountPages({pages:()=>pages,newPage:async()=>{created++;pages.push({isClosed:()=>false,url:()=> 'about:blank'})}});
  assert.equal(created,1);assert.equal(rejected.closed,true);
});
