const fs = require('node:fs');
const path = require('node:path');
const { writeJsonAtomically } = require('./atomicJson');
const { completeAccountLogin } = require('./authAccountLogin.cjs');
const { openAuthProfile } = require('./authStorefrontReady.cjs');
const SLOTS = {mx:['primary','second'],pe:['primary'],co:['primary','second'],cl:['primary']};

function credentialsForHandoff({market,slot}, {env=process.env,authRoot=path.resolve('playwright/.auth'),read=fs.readFileSync}={}) {
  if(!Object.hasOwn(SLOTS,market)||!SLOTS[market].includes(slot))return null;
  const upper=market.toUpperCase();
  const names=slot==='second'?[`${market}-second-storefront-user.json`]:['samsung-storefront-user.json',`${market}-storefront-user.json`,'co-storefront-user.json','mx-storefront-user.json'];
  let local={};
  for(const name of [...new Set(names)]) {try{local=JSON.parse(read(path.join(authRoot,name),'utf8'));break;}catch(error){if(error.code!=='ENOENT')return null;}}
  const email=slot==='second'?env[`${upper}_SECOND_SAMSUNG_EMAIL`]||local.email:env.SAMSUNG_ACCOUNT_EMAIL||env[`${upper}_SAMSUNG_EMAIL`]||local.email;
  const password=slot==='second'?env[`${upper}_SECOND_SAMSUNG_PASSWORD`]||local.password:env.SAMSUNG_ACCOUNT_PASSWORD||env[`${upper}_SAMSUNG_PASSWORD`]||local.password;
  return typeof email==='string'&&email.trim()&&typeof password==='string'&&password?{email:email.trim(),password}:null;
}
async function resumeHumanHandoff({market,environment,slot,passwordAttempted=true}, {
  chromium=require('@playwright/test').chromium,profilesRoot=path.resolve('playwright/profiles'),authRoot=path.resolve('playwright/.auth'),
  read=fs.readFileSync,write=writeJsonAtomically,readProfile=openAuthProfile,complete=completeAccountLogin,
  credentials=credentialsForHandoff,env=process.env,log=console.log,
}={}) {
  if(!Object.hasOwn(SLOTS,market)||!SLOTS[market].includes(slot)||!['S1','S2'].includes(environment))throw new Error('Invalid retained auth identity.');
  const host=environment==='S2'?'stg2.shop.samsung.com':'stg.shop.samsung.com';
  let browser,attempted=passwordAttempted;
  try {
    // Never launch a browser, create a page, navigate to login, or restart a
    // profile. A retained human handoff may only use its existing CDP browser.
    const profile=`${environment.toLowerCase()}-${market}-${slot==='second'?'second':'qa'}`;
    let endpoint;
    try {const [port,browserPath]=read(path.join(profilesRoot,profile,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535||!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath||''))return{status:'HUMAN_REQUIRED',passwordAttempted:attempted};endpoint=`ws://127.0.0.1:${port}${browserPath}`;}
    catch{return{status:'HUMAN_REQUIRED',passwordAttempted:attempted};}
    browser=await chromium.connectOverCDP(endpoint,{timeout:5000});
    const context=browser.contexts()[0];if(!context)return{status:'UNPROVEN',passwordAttempted:attempted};
    const account=context.pages().find(page=>{try{return new URL(page.url()).hostname==='account.samsung.com';}catch{return false;}});
    if(account) {
      if(attempted||!await account.locator('input[type="password"], #iptLgnPlnPD').filter({visible:true}).first().isVisible())return{status:'HUMAN_REQUIRED',passwordAttempted:attempted};
      const configured=credentials({market,slot},{env,authRoot,read});
      if(!configured)return{status:'HUMAN_REQUIRED',passwordAttempted:attempted};
      try {
        await complete(account,{market,hostname:host,credentials:configured,resumeOnly:true,timeout:20000,log:line=>{
          if(String(line).startsWith('AUTH_HANDOFF_AUDIT ')) {try{attempted=JSON.parse(String(line).slice(19)).passwordAttempted===true;}catch{attempted=true;}}
          else log(line);
        }});
      } catch(error) {return{status:error.exitCode===79?'HUMAN_REQUIRED':'UNPROVEN',passwordAttempted:attempted};}
    }
    const pages=context.pages().filter(page=>{try{const url=new URL(page.url());return url.protocol==='https:'&&url.hostname===host&&(url.pathname===`/${market}`||url.pathname.startsWith(`/${market}/`));}catch{return false;}}).reverse();
    let unproven=false;
    for(const page of pages) {
      let profile;
      try{profile=await readProfile(page,{market});}catch{unproven=true;continue;}
      if(profile.state!=='authenticated')continue;
      const url=new URL(page.url());if(url.protocol!=='https:'||url.hostname!==host||!(url.pathname===`/${market}`||url.pathname.startsWith(`/${market}/`)))continue;
      const state=await context.storageState({indexedDB:true});
      const api=(environment==='S1'&&market==='co'?'co':environment.toLowerCase())+'-smb-api-cdn.ecom-stg.samsung.com';
      const filtered={cookies:state.cookies.filter(cookie=>[host,api].includes(cookie.domain.replace(/^\./,''))||cookie.domain==='.samsung.com'),origins:state.origins.filter(origin=>new URL(origin.origin).hostname===host)};
      if(!filtered.cookies.some(cookie=>cookie.domain.replace(/^\./,'')===host))return{status:'UNPROVEN',passwordAttempted:attempted};
      const session=await page.evaluate(()=>Object.fromEntries(Array.from({length:sessionStorage.length},(_,index)=>{const key=sessionStorage.key(index);return[key,sessionStorage.getItem(key)];}).filter(([key])=>key!==null)));
      const prefix=`${market}-${environment.toLowerCase()}-`;
      write(path.join(authRoot,prefix+(slot==='second'?'second-user':'user')+'.json'),filtered);
      write(path.join(authRoot,prefix+(slot==='second'?'second-session-storage':'session-storage')+'.json'),session);
      return{status:'EXPORTED',passwordAttempted:attempted};
    }
    return{status:unproven?'UNPROVEN':'HUMAN_REQUIRED',passwordAttempted:attempted};
  } catch{return{status:'UNPROVEN',passwordAttempted:attempted};}
  finally {await browser?.close().catch(()=>{});}
}
module.exports={resumeHumanHandoff,credentialsForHandoff};
