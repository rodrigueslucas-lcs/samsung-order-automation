const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareAuthBrowserWindow, hasNativeAuthWindow } = require('../../utils/authBrowserWindow.cjs');

function fixture({ state = 'normal', missing = true, ignoredMaximize = false, noWindow = false, worker = false } = {}) {
  const calls = [];
  let windowState = state;
  let devtoolsClosed = false;
  const cdp = {
    async send(method, params) {
      calls.push([method, params]);
      if (method === 'Target.getTargets') return { targetInfos: [
        ...(worker ? [{targetId:'formatter-worker',type:'worker',url:'devtools://devtools/bundled/entrypoints/formatter_worker/formatter_worker-entrypoint.js'}] : []),
        ...(worker ? [{targetId:'frontend-tab',type:'tab',url:'devtools://devtools/bundled/devtools_app.html'}] : []),
        ...(!devtoolsClosed ? [{ targetId: 'devtools', type: 'other', url: 'devtools://devtools/bundled/inspector.html' }] : []),
        { targetId: 'restored', type: 'page', url: 'about:blank' },
        { targetId: 'storefront', type: 'page', url: 'https://stg.shop.samsung.com/co/' },
      ] };
      if(method==='Target.closeTarget'&&params.targetId==='formatter-worker')throw new Error('No web contents in the target');
      if(method==='Target.closeTarget'&&params.targetId==='frontend-tab')throw new Error('Specified target does not support closing');
      if(method==='Target.closeTarget'&&params.targetId==='devtools')devtoolsClosed=true;
      if (method === 'Browser.getWindowForTarget') {
        if (noWindow || (missing && params.targetId === 'restored')) throw new Error('Browser window not found');
        return { windowId: 7, bounds: { windowState } };
      }
      if (method === 'Browser.setWindowBounds' && !ignoredMaximize) windowState = params.bounds.windowState;
      if (method === 'Browser.getWindowBounds') return { bounds: { windowState } };
      return {};
    },
    async detach() { calls.push(['detach']); },
  };
  const page = {
    context: () => ({ browser: () => ({ newBrowserCDPSession: async () => cdp }) }),
    bringToFront: async () => calls.push(['front']),
  };
  return { page, calls };
}

test('auth window closes docked DevTools and maximizes a real window despite a restored target without a window', async () => {
  const { page, calls } = fixture();
  await prepareAuthBrowserWindow(page);
  assert.ok(calls.some(([method, params]) => method === 'Target.closeTarget' && params.targetId === 'devtools'));
  assert.ok(calls.some(([method, params]) => method === 'Browser.setWindowBounds' && params.bounds.windowState === 'maximized'));
  assert.equal(calls.at(-1)[0], 'detach');
});

test('DevTools formatter workers must not prevent closing the docked frontend',async()=>{
 const {page,calls}=fixture({worker:true});
 await prepareAuthBrowserWindow(page);
 assert.ok(!calls.some(([method,params])=>method==='Target.closeTarget'&&params.targetId==='formatter-worker'));
 assert.ok(!calls.some(([method,params])=>method==='Target.closeTarget'&&params.targetId==='frontend-tab'));
 assert.ok(calls.some(([method,params])=>method==='Target.closeTarget'&&params.targetId==='devtools'));
 assert.ok(calls.some(([method])=>method==='front'));
});

for (const state of ['fullscreen', 'minimized']) {
  test(`auth window restores ${state} before maximizing`, async () => {
    const { page, calls } = fixture({ state });
    await prepareAuthBrowserWindow(page);
    assert.deepEqual(calls.filter(([method]) => method === 'Browser.setWindowBounds').map(([, params]) => params.bounds.windowState), ['normal', 'maximized']);
  });
}

test('auth window fails if no native window exists and always detaches CDP', async () => {
  const { page, calls } = fixture({ noWindow: true });
  await assert.rejects(prepareAuthBrowserWindow(page), /no visible native window/);
  assert.equal(calls.at(-1)[0], 'detach');
});

test('auth window verifies that maximization actually took effect', async () => {
  const { page } = fixture({ ignoredMaximize: true });
  await assert.rejects(prepareAuthBrowserWindow(page), /did not remain maximized/);
});

test('native-window detection rejects onboarding-only Chrome without closing it', async () => {
  const { page, calls } = fixture({ noWindow: true });
  assert.equal(await hasNativeAuthWindow(page.context().browser()), false);
  assert.equal(calls.some(([method]) => method === 'Target.closeTarget'), false);
  assert.equal(calls.at(-1)[0], 'detach');
});

test('native-window detection finds a real storefront after a target without a window', async () => {
  const { page } = fixture();
  assert.equal(await hasNativeAuthWindow(page.context().browser()), true);
});

test('DevTools closure waits for frontend destruction while ignoring remaining tab descriptors',async()=>{
 const {closeAuthDevTools}=require('../../utils/authBrowserWindow.cjs');
 let checks=0,closes=0;
 const frontend={targetId:'frontend',type:'page',url:'devtools://devtools/bundled/devtools_app.html'};
 const descriptor={...frontend,targetId:'descriptor',type:'tab'};
 const cdp={send:async(method,params)=>{
  if(method==='Target.closeTarget'){assert.equal(params.targetId,'frontend');closes++;return{success:true};}
  assert.equal(method,'Target.getTargets');checks++;return{targetInfos:checks<3?[frontend,descriptor]:[descriptor]};
 }};
 assert.equal(await closeAuthDevTools(cdp,[frontend,descriptor],{pause:async()=>{}}),1);
 assert.equal(checks,3);assert.equal(closes,1);
});

test('an unclosed DevTools frontend remains a typed failure instead of claiming success',async()=>{
 const {closeAuthDevTools}=require('../../utils/authBrowserWindow.cjs');
 const frontend={targetId:'frontend',type:'page',url:'devtools://devtools/bundled/devtools_app.html'};
 const cdp={send:async method=>method==='Target.getTargets'?{targetInfos:[frontend]}:{success:false}};
 await assert.rejects(closeAuthDevTools(cdp,[frontend],{pause:async()=>{}}),e=>e.code==='AUTH_DEVTOOLS_CLOSE_FAILED');
});
