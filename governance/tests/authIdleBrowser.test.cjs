const {test}=require('node:test');
const assert=require('node:assert/strict');
const {closeIdleAuthBrowser}=require('../../utils/authIdleBrowser.cjs');
function fixture(urls,{gate=false}={}){
 let closes=0;
 const browser={isConnected:()=>true,contexts:()=>[{pages:()=>urls.map(url=>({isClosed:()=>false,url:()=>url,locator:()=>({filter:()=>({count:async()=>gate?1:0})})}))}],newBrowserCDPSession:async()=>({send:async command=>{assert.equal(command,'Browser.close');closes++;}})};
 return{browser,closes:()=>closes};
}
const options={market:'mx',environment:'S2',rootUrl:'https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/'};
for(const urls of [['about:blank'],['chrome-error://chromewebdata/','about:blank'],[options.rootUrl,'https://stg2.shop.samsung.com/getcookie.html','about:blank'],[options.rootUrl,'devtools://devtools/bundled/devtools_app.html']])test('ended owned auth closes its idle pages: '+urls.map(u=>new URL(u).pathname).join(','),async()=>{const f=fixture(urls);assert.equal(await closeIdleAuthBrowser(f.browser,options),true);assert.equal(f.closes(),1);});
for(const url of ['https://account.samsung.com/iam/oauth2/authorize','https://account.samsung.com/iam/blocked','https://www.samsung.com/mx/','https://stg2.shop.samsung.com/co/','https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/checkout/one','https://example.invalid/'])test('idle cleanup preserves unknown, human or business page '+url,async()=>{const f=fixture(['about:blank',url]);assert.equal(await closeIdleAuthBrowser(f.browser,options),false);assert.equal(f.closes(),0);});
test('an explicit human handoff survives even on a blank/loading view',async()=>{const f=fixture(['about:blank']);assert.equal(await closeIdleAuthBrowser(f.browser,{...options,humanRequired:true}),false);assert.equal(f.closes(),0);});
test('a corporate activation form on the owned homepage survives',async()=>{const f=fixture([options.rootUrl],{gate:true});assert.equal(await closeIdleAuthBrowser(f.browser,options),false);assert.equal(f.closes(),0);});
test('cleanup validates exact staging market before any close',async()=>{const f=fixture(['about:blank']);await assert.rejects(closeIdleAuthBrowser(f.browser,{...options,rootUrl:'https://www.samsung.com/mx/'}),/staging market/);assert.equal(f.closes(),0);});
test('real Chromium blank and ended staging landing close without retaining the process',async()=>{
 const {chromium}=require('@playwright/test');const browser=await chromium.launch({headless:true});try{const context=await browser.newContext(),page=await context.newPage();await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<h1>Page Under Maintenance</h1>'}));await page.goto(options.rootUrl);await context.newPage();assert.equal(await closeIdleAuthBrowser(browser,options),true);await new Promise(resolve=>{if(!browser.isConnected())resolve();else browser.once('disconnected',resolve);});assert.equal(browser.isConnected(),false);}finally{await browser.close();}
});
const {refreshAuth}=require('../../utils/authRefreshRunner.cjs');
for(const status of [1,79])test('Base refresh failure cleanup preserves human state, status '+status,async()=>{
 const calls=[];await assert.rejects(refreshAuth({market:'cl',environment:'S2',env:{}},{acquireMarket:()=>()=>calls.push('market released'),acquire:()=>()=>calls.push('lock released'),securityGate:async()=>null,runChild:async()=>status,log:()=>{},captureBrowser:async()=>({closeIdle:async()=>{calls.push('closed idle');return true;},dispose:async()=>calls.push('disconnected')})}));
 assert.equal(calls.includes('closed idle'),status!==79);assert.equal(calls.at(-1),'market released');
});
