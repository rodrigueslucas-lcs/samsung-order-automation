const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const{chromium}=require('@playwright/test');const{connectAuthBrowser}=require('../../utils/authDedicatedBrowser.cjs');const{openSecondAccountQr}=require('../../utils/authAccountQr.cjs');
test('real Chrome reused foreign port cannot attach to the wrong market after restart',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'auth-reboot-port-'));let a,b,attached;
 try{const profile=path.join(root,'s2-mx-qa');a=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,args:['--remote-debugging-port=0']});b=await chromium.launchPersistentContext(path.join(root,'s2-pe-qa'),{channel:'chrome',headless:true,args:['--remote-debugging-port=0']});await a.pages()[0].evaluate(()=>window.fixtureMarket='MX');await b.pages()[0].evaluate(()=>window.fixtureMarket='PE');const file=path.join(profile,'DevToolsActivePort'),actual=fs.readFileSync(file,'utf8'),[aPort,aPath]=actual.trim().split(/\r?\n/),[foreignPort]=fs.readFileSync(path.join(root,'s2-pe-qa','DevToolsActivePort'),'utf8').trim().split(/\r?\n/);fs.writeFileSync(file,`${foreignPort}\n${aPath}\n`);let recoveries=0;
 attached=await connectAuthBrowser({chromium,profileDir:profile,market:'mx',environment:'S2'},{hasWindow:async browser=>browser.contexts()[0].pages().length>0,launch:()=>assert.fail('wrong port must not open another browser'),recoverEndpoint:async()=>{recoveries++;fs.writeFileSync(file,actual);return{occupied:true,endpoint:`ws://127.0.0.1:${aPort}${aPath}`};},log(){}});assert.equal(recoveries,1);assert.equal(await attached.contexts()[0].pages()[0].evaluate(()=>window.fixtureMarket),'MX');assert.equal(await b.pages()[0].evaluate(()=>window.fixtureMarket),'PE');
 }finally{await attached?.close();await a?.close();await b?.close();assert.ok(root.startsWith(path.resolve(os.tmpdir())+path.sep));await fs.promises.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
test('real late Samsung QR button is selected once after OAuth hydration', async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body: `<main id="root">Inicie sesión</main><script>
   setTimeout(()=>{const button=document.createElement('button');button.textContent='Iniciar sesión con código QR';
    button.onclick=()=>{sessionStorage.clicks=Number(sessionStorage.clicks||0)+1;history.pushState({},'', '/iam/sign-in/credentials/qr-code');button.replaceWith(document.createTextNode('Escanea código QR'));};
    document.querySelector('#root').append(button);},6000);
  </script>`}));
  await page.goto('https://account.samsung.com/iam/oauth2/authorize');
  assert.equal(await openSecondAccountQr(page,{slot:'second',log(){}}),true);
  assert.equal(new URL(page.url()).pathname,'/iam/sign-in/credentials/qr-code');
  assert.equal(await page.evaluate(()=>sessionStorage.clicks),'1');
  assert.equal(await openSecondAccountQr(page,{slot:'second',log(){}}),true);
  assert.equal(await page.evaluate(()=>sessionStorage.clicks),'1');
 }finally{await browser.close();}
});
