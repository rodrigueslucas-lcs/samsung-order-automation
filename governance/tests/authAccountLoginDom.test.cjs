const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { completeAccountLogin } = require('../../utils/authAccountLogin.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
test('retained FIRST waits through the empty email-to-password transition without resubmitting',async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 const html=`<input id="account" value="fixture@example.test"><button onclick="window.submits=(window.submits||0)+1;document.querySelector('#account').hidden=true;this.hidden=true;setTimeout(()=>document.querySelector('#password-step').hidden=false,700)">Siguiente</button><div id="password-step" hidden><input type="password"><button onclick="if(window.submits===1&&document.querySelector('[type=password]').value==='fixture-only')location.href='https://stg2.shop.samsung.com/pe/'">Iniciar sesión</button></div>`;
 await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:r.request().url().includes('account.samsung.com')?html:'<main>Fixture</main>'}));
 try{
  await page.goto('https://account.samsung.com/accounts/fixture');
  await completeAccountLogin(page,{market:'pe',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture-only'},resumeOnly:true,resumeEmailPhase:'READY',timeout:10000,log(){}});
  await page.waitForURL('https://stg2.shop.samsung.com/pe/');
 }finally{await context.close();}
});
for(const badge of ['class','declared-invisible'])test(`invisible provider badge (${badge}) never blocks automatic email/password submission`,async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 const iframe=badge==='class'?'<div class="grecaptcha-badge"><iframe title="reCAPTCHA" srcdoc="Provider badge"></iframe></div>':'<iframe title="reCAPTCHA" src="https://fixture.invalid/anchor?size=invisible"></iframe>';
 const html=`<meta charset="utf-8">${iframe}<input id="account"><button onclick="document.querySelector('#account').hidden=true;this.hidden=true;document.querySelector('#password-step').hidden=false;">Siguiente</button><div id="password-step" hidden><input type="password"><button onclick="if(document.querySelector('[type=password]').value==='fixture-only')location.href='https://stg2.shop.samsung.com/pe/'">Iniciar sesión</button></div>`;
 await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:r.request().url().includes('account.samsung.com')?html:'<main>Fixture</main>'}));
 try{await page.goto('https://account.samsung.com/accounts/fixture');await completeAccountLogin(page,{market:'pe',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture-only'},timeout:10000,log(){}});await page.waitForURL('https://stg2.shop.samsung.com/pe/');}finally{await context.close();}
});
test('provider resets email when its initial CAPTCHA opens; FIRST restores it and submits both steps',async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 const html=`<input id="account"><button onclick="if(window.solved){document.querySelector('#account').hidden=true;this.hidden=true;document.querySelector('#password-step').hidden=false;}">Siguiente</button><iframe id="widget" title="reCAPTCHA" srcdoc="<div role=checkbox aria-checked=false onclick='parent.postMessage(1,&quot;*&quot;)'>Checkbox</div>"></iframe><iframe id="challenge" title="visual challenge fixture" hidden srcdoc="Human fixture gate"></iframe><div id="password-step" hidden><input type="password"><button onclick="if(document.querySelector('[type=password]').value==='fixture-only')location.href='https://stg2.shop.samsung.com/pe/'">Iniciar sesión</button></div><script>window.addEventListener('message',()=>{document.querySelector('#account').value='';document.querySelector('#challenge').hidden=false;})</script>`;
 await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:r.request().url().includes('account.samsung.com')?html:'<main>Fixture storefront</main>'}));
 try{
  await page.goto('https://account.samsung.com/accounts/fixture');
  const outcome=completeAccountLogin(page,{market:'pe',hostname:'stg2.shop.samsung.com',credentials:{email:'fixture@example.test',password:'fixture-only'},timeout:10000,log(){}}).then(()=>null,error=>error);
  await page.locator('#challenge').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#account').value==='fixture@example.test',{},{timeout:3000});
  assert.equal(await page.locator('[type=password]').inputValue(),'');
  await page.frameLocator('#widget').getByRole('checkbox').evaluate(e=>e.setAttribute('aria-checked','true'));
  await page.evaluate(()=>{window.solved=true;document.querySelector('#challenge').hidden=true;});
  assert.equal(await outcome,null);await page.waitForURL('https://stg2.shop.samsung.com/pe/');
 }finally{await context.close();}
});
for(const interrupted of [false,true])test(`retained email step continues after fixture CAPTCHA (interrupted=${interrupted})`,async()=>{
  const context=await browser.newContext();const page=await context.newPage();
  const html=`<input id="account"><button id="next" onclick="window.clicks=(window.clicks||0)+1;if(!window.started){window.started=true;document.querySelector('#widget').hidden=false;}else if(window.solved){document.querySelector('#account').hidden=true;this.hidden=true;document.querySelector('#password-step').hidden=false;}">Siguiente</button><iframe id="widget" title="reCAPTCHA" hidden srcdoc="<div role=checkbox aria-checked=false onclick='parent.postMessage(1,&quot;*&quot;)'>Checkbox</div>"></iframe><iframe id="challenge" title="visual challenge fixture" hidden srcdoc="Human fixture gate"></iframe><div id="password-step" hidden><input type="password"><button onclick="if(document.querySelector('[type=password]').value==='fixture-only')location.href='https://stg2.shop.samsung.com/mx/'">Iniciar sesión</button></div><script>window.addEventListener('message',()=>document.querySelector('#challenge').hidden=false)</script>`;
  await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:r.request().url().includes('account.samsung.com')?html:'<main>Fixture authenticated return</main>'}));
  try {
    await page.goto('https://account.samsung.com/accounts/fixture');
    let audit;
    const credentials={email:'fixture@example.test',password:'fixture-only'};
    const login=completeAccountLogin(page,{market:'mx',hostname:'stg2.shop.samsung.com',credentials,timeout:interrupted?2500:7000,log(line){if(line.startsWith('AUTH_HANDOFF_AUDIT '))audit=JSON.parse(line.slice(19));}});
    const outcome=login.then(()=>null,error=>error);
    await Promise.race([page.locator('#challenge').waitFor({state:'visible'}),outcome.then(error=>{if(error)throw error;})]);
    assert.equal(await page.locator('#account').inputValue(),'fixture@example.test');
    assert.equal(await page.locator('[type=password]').inputValue(),'');
    if(interrupted){assert.equal((await outcome).exitCode,79);assert.equal(audit.emailPhase,'CHALLENGE');assert.equal(audit.passwordAttempted,false);}
    await page.frameLocator('#widget').getByRole('checkbox').evaluate(e=>e.setAttribute('aria-checked','true'));
    await page.evaluate(()=>{window.solved=true;document.querySelector('#challenge').hidden=true;});
    if(interrupted)await completeAccountLogin(page,{market:'mx',hostname:'stg2.shop.samsung.com',credentials,resumeOnly:true,resumeEmailPhase:audit.emailPhase,timeout:7000,log(){}});
    else assert.equal(await outcome,null);
    await page.waitForURL('https://stg2.shop.samsung.com/mx/');
  }finally{await context.close();}
});
for (const market of ['mx','pe','co','cl']) for (const host of ['stg.shop.samsung.com','stg2.shop.samsung.com']) {
  test(market + ' ' + host + ': human resolves fixture challenge, password and Continue are automatic', async () => {
    const context = await browser.newContext(); const page = await context.newPage();
    const widget = '<div role="checkbox" aria-checked="false" onclick="parent.postMessage(\'fixture-challenge\',\'*\')">Checkbox</div>';
    const html = '<meta charset="utf-8"><input type="email"><button id="next" onclick="document.querySelector(\'#widget\').hidden=false;this.hidden=true">Siguiente</button>' +
      '<iframe title="reCAPTCHA" style="visibility:hidden" srcdoc="<div role=checkbox aria-checked=false>Old widget</div>"></iframe>' +
      '<iframe id="widget" title="reCAPTCHA" hidden srcdoc="' + widget.replaceAll('&','&amp;').replaceAll('"','&quot;') + '"></iframe>' +
      '<iframe id="challenge" title="visual challenge fixture" hidden srcdoc="Manual fixture gate"></iframe>' +
      '<div id="password-step" hidden><input type="password"><button onclick="if(document.querySelector(\'[type=password]\').value!==\'fixture-only\')throw Error(\'Fixture password missing\');location.href=\'https://' + host + '/' + market + '/\'">Continuar</button></div>' +
      '<script>window.addEventListener("message",e=>{if(e.data==="fixture-challenge")document.querySelector("#challenge").hidden=false;});</script>';
    await page.route('**/*', route => route.fulfill({ status:200, contentType:'text/html; charset=utf-8', body:route.request().url().includes('account.samsung.com') ? html : '<main>Fixture storefront</main>' }));
    try {
      await page.goto('https://account.samsung.com/accounts/fixture');
      const login = completeAccountLogin(page,{market,hostname:host,credentials:{email:'fixture@example.test',password:'fixture-only'},timeout:15000,log(){}});
      // This is a local fixture simulating the human, never a provider CAPTCHA.
      await page.locator('#challenge').waitFor({state:'visible'});
      assert.equal(await page.locator('input[type=password]').inputValue(),'');
      await page.frameLocator('#widget').getByRole('checkbox').evaluate(n=>n.setAttribute('aria-checked','true'));
      await page.evaluate(()=>{document.querySelector('#challenge').hidden=true;document.querySelector('#password-step').hidden=false;});
      await login;
      await page.waitForURL('https://' + host + '/' + market + '/');
      assert.equal(new URL(page.url()).hostname,host);
    } finally { await context.close(); }
  });
}
