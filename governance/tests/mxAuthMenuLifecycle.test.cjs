const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('@playwright/test');
function actualMxAuth(){
 const source=fs.readFileSync('utils/mxAuthState.js','utf8'),module={exports:{}};
 const load=name=>{
  if(name==='./mxConfig')return{resolveMxEnvironment:()=>({name:'S2',hostname:'stg2.shop.samsung.com'})};
  if(name==='./registeredSessionRecovery')return{withRegisteredSessionRecovery:state=>state};
  return require(name.startsWith('./')?'../../utils/'+name.slice(2):name);
 };
 vm.runInNewContext(source,{module,exports:module.exports,require:load,process:{env:{}},console});return module.exports;
}
async function fixture(run,{signedOut=false}={}){
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();
  await page.route('https://stg2.shop.samsung.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><button aria-label="My Profile" onmouseenter="document.querySelector('#active').hidden=false">Profile</button><div id="active" role="menu" class="profile-menu" hidden>${signedOut?'<button data-an-la="login">Iniciar sesión</button>':'<button>Cerrar sesión</button>'}</div><div role="menu" class="profile-menu mat-menu-panel-exit-animation">Closing animation</div>`}));
  await page.goto('https://stg2.shop.samsung.com/mx/mypage/profile-setting');
  await run(actualMxAuth(),page);
 }finally{await browser.close();}
}
test('MX auth proves logout in the active menu while an old visible menu is closing',()=>fixture(async(auth,page)=>{await auth.validateCurrentPageAuthenticated(page);}));
test('a closing old logout cannot authenticate the active signed-out menu',()=>fixture(async(auth,page)=>{
 await page.locator('.mat-menu-panel-exit-animation').evaluate(el=>el.innerHTML='<button>Cerrar sesión</button>');
 await assert.rejects(auth.validateCurrentPageAuthenticated(page),{code:'AUTH_SIGNED_OUT'});
},{signedOut:true}));
