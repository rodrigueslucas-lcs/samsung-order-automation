const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { completeAccountLogin } = require('../../utils/authAccountLogin.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
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
