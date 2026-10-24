const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { acquireRefreshLock } = require('./authRefreshRunner.cjs');
const { acquireMarketLease } = require('./authMarketLease.cjs');
const { normalizeEnvironment } = require('./authRefreshAllRunner.cjs');
const { sessionContentHash } = require('./authBundleContent.cjs');
const { writeJsonAtomically } = require('./atomicJson');
const MARKET_SLOTS = Object.freeze({ mx: Object.freeze(['primary','second']), pe: Object.freeze(['primary']), co: Object.freeze(['primary','second']), cl: Object.freeze(['primary']) });
const PACKAGE_SCRIPTS = Object.fromEntries(Object.keys(MARKET_SLOTS).map(m => [m, `scripts/auth-package-${m}.cjs`]));
const PUBLISH_SCRIPTS = { mx: 'scripts/auth-publish-jenkins.cjs', pe: 'scripts/auth-publish-jenkins-pe.cjs', co: 'scripts/auth-publish-jenkins-co.cjs', cl: 'scripts/auth-publish-jenkins-cl.cjs' };
const sessionBundlePath = (market, environment) => path.resolve('playwright/.session-packages', `${market}-${environment.toLowerCase()}-session-bundle.json`);
function fileHash(file, { exists = fs.existsSync, read = fs.readFileSync } = {}) { return exists(file) ? crypto.createHash('sha256').update(read(file)).digest('hex') : null; }
function readCheckpoint(market, environment) {
  const file = path.resolve('playwright/.auth', `.keepalive-${market}-${environment.toLowerCase()}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('Keep-alive checkpoint is unreadable; refusing to lose pending publication.'); }
}
function saveCheckpoint(market, environment, state) {
  writeJsonAtomically(path.resolve('playwright/.auth', `.keepalive-${market}-${environment.toLowerCase()}.json`), state);
}
function identityEnv(market, environment, slot, baseEnv = process.env) {
  if (!MARKET_SLOTS[market]?.includes(slot)) throw new Error('Unsupported keep-alive identity.');
  const upper = market.toUpperCase();
  const env = { ...baseEnv, ENVIRONMENT: environment, [`${upper}_QST_ENVIRONMENT`]: environment, [`${upper}_AUTH_SLOT`]: slot, AUTH_REFRESH_SLOT: slot, AUTH_KEEPALIVE: '1', [`${upper}_AUTH_AUTO_RENEW`]: '0', REGISTERED_AUTH_REHYDRATE: '0', JENKINS_AUTH_PUBLISH: '0' };
  if (market !== 'mx') delete env.MX_AUTH_SLOT;
  if (slot === 'second') env[`${upper}_AUTH_MANUAL`] = '1';
  return env;
}
function runNodeScript(script, env, { spawnChild = spawn, timeoutMs = 240000, stdout = () => {}, stderr = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const args = env.AUTH_MARKET_LEASE ? ['scripts/auth-leased-child.cjs', script] : [script];
    const child = spawnChild(process.execPath, args, { env, stdio: ['ignore','pipe','pipe'], windowsHide: true });
    let audit, handoff, lineBuffer = '', diagnostic = null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    // Output is consumed but never retained in returned results/checkpoints.
    child.stdout?.on('data', chunk => {
      const lines = (lineBuffer + String(chunk)).split(/\r?\n/); lineBuffer = lines.pop().slice(-2048);
      for (const line of lines) if (line.startsWith('AUTH_HEALTH_AUDIT ')) {
        try { const value = JSON.parse(line.slice('AUTH_HEALTH_AUDIT '.length)); if (Number.isInteger(value.accountPages) && value.accountPages >= 0 && typeof value.statePersisted === 'boolean') audit = {accountPages:value.accountPages,statePersisted:value.statePersisted}; } catch {}
      }
      else if(line.startsWith('AUTH_HANDOFF_AUDIT ')) {
        try { const value=JSON.parse(line.slice('AUTH_HANDOFF_AUDIT '.length)); if(typeof value.passwordAttempted==='boolean')handoff={passwordAttempted:value.passwordAttempted,...(['NONE','READY','CHALLENGE'].includes(value.emailPhase)?{emailPhase:value.emailPhase}:{})}; } catch {}
      }
      stdout(String(chunk));
    });
    child.stderr?.on('data', chunk => {
      const text = String(chunk);
      if (text.includes('[auth:lease]')) diagnostic = 'CHILD_LEASE_ENTRY';
      else if (/AUTH RECOVERY REQUIRED/.test(text)) diagnostic = 'AUTH_RECOVERY_REQUIRED';
      else if (/profile menu did not open|authenticated logout control was not rendered/.test(text)) diagnostic = 'AUTH_NOT_PROVEN';
      else if (/net::ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND/.test(text)) diagnostic = 'NETWORK_ERROR';
      else { const kind = /\b(SyntaxError|ReferenceError|TypeError|TimeoutError)\b/.exec(text); if (kind) diagnostic = kind[1]; }
      stderr(text);
    });
    const stop = signal => child.kill(signal);
    const interrupt = () => stop('SIGINT'), terminate = () => stop('SIGTERM');
    process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
    const cleanup = () => { clearTimeout(timer); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); };
    child.once('error', () => { cleanup(); reject(new Error('Keep-alive child could not start.')); });
    child.once('close', (code, signal) => { cleanup(); resolve({ code: code ?? 1, signal: signal || null, timedOut, audit, handoff, diagnostic }); });
  });
}
async function verifyIdentity({ market, environment, slot, env = process.env, attempts = 2 }, { acquire = acquireRefreshLock, runScript = runNodeScript, log = console.log, pause = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let release;
  try { release = acquire(market, environment, slot); }
  catch (e) { if (e.code === 'AUTH_BUSY' || /already active/i.test(e.message)) return { market, environment, slot, status: 'BUSY', attempts: 0 }; throw e; }
  try {
    const outcomes = [], diagnostics = [], audits = [];
    for (let attempt = 1; attempt <= Math.min(2, attempts); attempt++) {
      log(`[keepalive:${market}] ${environment} ${slot} verify ${attempt}/2`);
      const result = await runScript(`scripts/auth-verify-${market}.cjs`, identityEnv(market, environment, slot, env), { timeoutMs: 240000 });
      if (result.code === 0 && !result.timedOut && !result.signal && result.audit?.statePersisted && result.audit?.accountPages === 0) return { market, environment, slot, status: 'HEALTHY', attempts: attempt, code: 0, audit: result.audit };
      diagnostics.push(result.diagnostic || null); audits.push(result.audit || null);
      outcomes.push(result.timedOut || result.signal ? 21 : result.code === 0 ? 22 : result.code);
      if (attempt < Math.min(2, attempts)) await pause(1500);
    }
    // A mixed network/invalid result cannot establish persistent expiration.
    const status = outcomes.length === 2 && outcomes.every(code => code === 20) ? 'NEEDS_REFRESH' : outcomes.every(code => code === 21) ? 'TRANSIENT_ERROR' : 'UNPROVEN';
    return { market, environment, slot, status, attempts: outcomes.length, code: outcomes.at(-1), verifyCodes: outcomes, diagnostics, audits };
  } finally { release(); }
}
async function recoverIdentity({ market, environment, slot, env = process.env }, { runScript = runNodeScript, log = console.log, onEvent = () => {} } = {}) {
  const runtimeEnv = identityEnv(market, environment, slot, env);
  delete runtimeEnv.AUTH_KEEPALIVE; // Refresh has its own fresh verify and normal interactive contract.
  runtimeEnv[`${market.toUpperCase()}_AUTH_INTERACTIVE_TIMEOUT_MS`] = String(Math.min(600000, Number(env.AUTH_KEEPALIVE_INTERACTIVE_TIMEOUT_MS || 600000)));
  log(`[keepalive:${market}] ${environment} ${slot} REFRESH (two positively invalid checks)`);
  let informed = false;
  const onOutput = chunk => { if (!informed && /CAPTCHA\/MFA requires human completion|manual mode|Complete login\/CAPTCHA|Complete Samsung Account login\/CAPTCHA/.test(chunk)) { informed = true; log(`[keepalive:${market}] ${slot}: complete human verification in the dedicated Chrome window.`); try { onEvent({ market, slot, status:'HUMAN_REQUIRED' }); } catch {} } };
  const result = await runScript(`scripts/auth-refresh-${market}.cjs`, runtimeEnv, { timeoutMs: 900000, stdout: onOutput, stderr: onOutput });
  const status = result.code === 0 && !result.timedOut && !result.signal ? 'RECOVERED' : result.code === 2 ? 'HUMAN_REQUIRED' : result.code === 3 ? 'BUSY' : 'FAILED';
  return { market, environment, slot, status, code: result.code, ...(status==='HUMAN_REQUIRED'||(informed&&status!=='RECOVERED')?{humanPending:true,passwordAttempted:result.handoff?.passwordAttempted??true,emailPhase:result.handoff?.emailPhase||'NONE'}:{}) };
}
async function resumeIdentity({market,environment,slot,env=process.env,passwordAttempted=true,emailPhase='NONE'},{runScript=runNodeScript,verify=verifyIdentity,captureBrowser=require('./authBrowserLifecycle.cjs').captureAuthBrowser,browserClosed=require('./authBrowserLifecycle.cjs').authBrowserClosed,acquire=acquireRefreshLock}={}) {
  let release,owned,keep=false,childInvoked=false;
  const base={market,environment,slot};
  try {
    try {release=acquire(market,environment,slot);}catch{return{...base,status:'BUSY'};}
    owned=await captureBrowser(base);
    if(!owned)return{...base,status:await browserClosed(base)?'HANDOFF_CLOSED':'HUMAN_REQUIRED',passwordAttempted};
    const runtime={...identityEnv(market,environment,slot,env),AUTH_HANDOFF_PASSWORD_ATTEMPTED:passwordAttempted?'1':'0',AUTH_HANDOFF_EMAIL_PHASE:['READY','CHALLENGE'].includes(emailPhase)?emailPhase:'NONE'};
    childInvoked=true;
    const result=await runScript('scripts/auth-resume-human.cjs',runtime,{timeoutMs:90000});
    release();release=null;
    if(result.code!==0||result.timedOut||result.signal)return{...base,status:result.code===2?'HUMAN_REQUIRED':'UNPROVEN',passwordAttempted:result.handoff?.passwordAttempted??true,emailPhase:result.handoff?.emailPhase||'NONE'};
    const proof=await verify({...base,env});
    if(proof.status!=='HEALTHY'||!proof.audit?.statePersisted||proof.audit.accountPages!==0)return{...base,status:'UNPROVEN',passwordAttempted:result.handoff?.passwordAttempted??true};
    const resumed={...proof,status:'RECOVERED'};
    Object.defineProperty(resumed,'_browser',{value:owned});keep=true;
    return resumed;
  } catch{return{...base,status:'UNPROVEN',passwordAttempted:childInvoked?true:passwordAttempted,emailPhase:childInvoked?'NONE':emailPhase};}
  finally {release?.();if(!keep)await owned?.dispose();}
}
async function packageAndPublishMarket({ market, environment, publish, env = process.env, state = {}, beforeHash = null }, { runScript = runNodeScript, hash = fileHash, contentHash = file => sessionContentHash(JSON.parse(fs.readFileSync(file, 'utf8'))), save = saveCheckpoint, log = console.log } = {}) {
  const bundle = sessionBundlePath(market, environment);
  const phaseEnv = identityEnv(market, environment, 'primary', env);
  const packaged = await runScript(PACKAGE_SCRIPTS[market], phaseEnv, { timeoutMs: 60000 });
  if (packaged.code !== 0 || packaged.timedOut || packaged.signal) return { market, status: 'PACKAGE_FAILED', changed: false, published: false };
  const after = hash(bundle);
  if (!after) return { market, status: 'PACKAGE_FAILED', changed: false, published: false };
  const semantic = contentHash(bundle);
  const changed = beforeHash !== after;
  const needsPublish = state.publishedContentHash !== semantic;
  if (!publish || !needsPublish) { log(`[keepalive:${market}] bundle=${changed ? 'changed' : 'same'} publish=${publish ? 'unchanged' : 'disabled'}`); return { market, status: 'READY', changed, published: false, synchronized:!needsPublish, contentHash: semantic, fileHash: after }; }
  const result = await runScript(PUBLISH_SCRIPTS[market], { ...phaseEnv, JENKINS_AUTH_PUBLISH: '1' }, { timeoutMs: 120000 });
  if (result.code !== 0 || result.timedOut || result.signal) return { market, status: 'PUBLISH_FAILED', changed, published: false };
  save(market, environment, { ...state, publishedContentHash: semantic, publishedFileHash: after });
  return { market, status: 'READY', changed, published: true, synchronized:true, contentHash: semantic, fileHash: after };
}
function limitConcurrency(maximum) {
  let active = 0; const pending = [];
  return async action => {
    if (active >= maximum) await new Promise(resolve => pending.push(resolve));
    else active++;
    try { return await action(); }
    finally { const next = pending.shift(); if (next) next(); else active--; }
  };
}
async function runKeepAliveCycle({ environment = 'S2', markets = Object.keys(MARKET_SLOTS), publish = true, env = process.env, onEvent = () => {} } = {}, { verify = verifyIdentity, recover = recoverIdentity, resume = resumeIdentity, captureBrowser = require('./authBrowserLifecycle.cjs').captureAuthBrowser, browserClosed = require('./authBrowserLifecycle.cjs').authBrowserClosed, finalize = packageAndPublishMarket, acquireMarket = acquireMarketLease, readState = readCheckpoint, saveState = saveCheckpoint, hash = fileHash, log = console.log, now = Date.now } = {}) {
  const target = normalizeEnvironment(environment);
  if (!Array.isArray(markets) || !markets.length || markets.some(m => !MARKET_SLOTS[m])) throw new Error('Unsupported keep-alive market scope.');
  const selected = [...new Set(markets)], verifyLane = limitConcurrency(3), refreshLane = limitConcurrency(2);
  // Observability cannot change authentication, publication or lock outcomes.
  const notify = event => { try { onEvent(event); } catch {} };
  log('[auth:keepalive] ' + target + ': ' + selected.join(',').toUpperCase() + '; two strict checks; FIRST recovery before SECOND.');
  const records = selected.map(market => ({market, checked:MARKET_SLOTS[market].map(slot=>({market,environment:target,slot}))}));
  const fail = (record,status='FAILED') => {record.checked=record.checked.map(({market,environment,slot})=>({market,environment,slot,status}));record.failed=true;};
  try {
    for (const record of records) {
      try {
        record.release=acquireMarket(record.market,target,{env});
        record.env={...env,...record.release.env};
        record.beforeHash=hash(sessionBundlePath(record.market,target));
        record.state=readState(record.market,target);
      } catch(error) {fail(record,error.code==='AUTH_BUSY'?'BUSY':'FAILED');}
    }
    await Promise.all(records.filter(r=>!r.failed).flatMap(record=>record.checked.map(async(identity,index)=>{
      try {record.checked[index]=await verifyLane(async()=>{ notify({...identity,status:'VERIFYING'}); const started=now(); const result=await verify({...identity,env:record.env}); const measured={...result,verifyDurationMs:Math.max(0,now()-started)}; notify(measured); return measured; });}
      catch {record.checked[index]={...identity,status:'FAILED'};}
    })));
    const recoverSlot=async(slot)=>{
      const waiting=records.filter(r=>!r.failed).flatMap(record=>record.checked.map((identity,index)=>({record,identity,index}))).filter(({identity})=>identity.slot===slot&&identity.status==='NEEDS_REFRESH');
      if(!waiting.length)return;
      if(slot==='second'&&records.some(r=>r.checked.some(i=>i.slot==='primary'&&(i.status==='HUMAN_REQUIRED'||i.humanPending||(r.state?.human?.primary&&!['HEALTHY','RECOVERED'].includes(i.status)))))) {
        log('[auth:keepalive] FIRST requires human verification; SECOND renewal remains deferred.');
        for(const {record,identity,index} of waiting){record.checked[index]={...identity,status:'WAITING_PRIMARY'};notify(record.checked[index]);}
        return;
      }
      if(slot==='second') log('[auth:keepalive] FIRST phase finished. Starting SECOND renewal only.');
      else log('[auth:keepalive] Starting FIRST renewal only; SECOND login windows are deferred.');
      await Promise.all(waiting.map(({record,identity,index})=>refreshLane(async()=>{
        const {market,environment,slot}=identity;
        if(slot==='second' && records.some(r=>r.checked.some(i=>i.slot==='primary'&&(i.status==='HUMAN_REQUIRED'||i.humanPending||(r.state?.human?.primary&&!['HEALTHY','RECOVERED'].includes(i.status)))))) {record.checked[index]={market,environment,slot,status:'WAITING_PRIMARY'};notify(record.checked[index]);return;}
        if(record.state.human?.[slot]) {
          const started=now();
          let ended=false;
          try {
            const result=await resume({market,environment,slot,env:record.env,passwordAttempted:record.state.handoff?.[slot]?.passwordAttempted??true,emailPhase:record.state.handoff?.[slot]?.emailPhase||'NONE'});
            if(result.status==='HANDOFF_CLOSED') {
              ended=true;record.state.human={...record.state.human};delete record.state.human[slot];record.state.handoff={...record.state.handoff};delete record.state.handoff[slot];
              notify({market,slot,status:'HANDOFF_ENDED'});
            } else {
            if(typeof result.passwordAttempted==='boolean')record.state.handoff={...record.state.handoff,[slot]:{passwordAttempted:result.passwordAttempted,emailPhase:['READY','CHALLENGE'].includes(result.emailPhase)?result.emailPhase:'NONE'}};
            if(result._browser){record.resumeHandles||={};record.resumeHandles[slot]=result._browser;record.state.pendingClose={...record.state.pendingClose,[slot]:result._browser.fingerprint};}
            record.checked[index]={...result,verifyDurationMs:identity.verifyDurationMs,refreshDurationMs:Math.max(0,now()-started)};
            }
          } catch {record.checked[index]={market,environment,slot,status:'UNPROVEN'};}
          if(!ended){notify(record.checked[index]);return;}
        }
        const recoveryEvent=event=>{
          if(event.status==='HUMAN_REQUIRED') {
            // Persist the gate before waiting: a scheduler timeout or killed
            // parent must not turn the next cycle into another login attempt.
            record.state.human={...record.state.human,[slot]:true};
            record.state.handoff={...record.state.handoff,[slot]:{passwordAttempted:true}};
            saveState(market,target,record.state);
          }
          notify(event);
        };
        try {notify({market,slot,status:'REFRESHING'});const started=now();record.checked[index]={...await recover({market,environment,slot,env:record.env},{onEvent:recoveryEvent}),verifyDurationMs:identity.verifyDurationMs,refreshDurationMs:Math.max(0,now()-started)};notify(record.checked[index]);
        const recovered=record.checked[index];
        if(recovered.status==='HUMAN_REQUIRED'||recovered.humanPending){
          record.state.human={...record.state.human,[slot]:true};
          record.state.handoff={...record.state.handoff,[slot]:{passwordAttempted:recovered.passwordAttempted??record.state.handoff?.[slot]?.passwordAttempted??true,emailPhase:['READY','CHALLENGE'].includes(recovered.emailPhase)?recovered.emailPhase:'NONE'}};
          // Persist the final child audit immediately, before waiting for other
          // markets. A later scheduler interruption must not lose safe resume.
          saveState(market,target,record.state);
        }
        if(['FAILED','HUMAN_REQUIRED','UNPROVEN'].includes(record.checked[index].status)){
          try{const handle=await captureBrowser({market,environment,slot});if(handle){record.resumeHandles||={};record.resumeHandles[slot]=handle;record.state.pendingClose={...record.state.pendingClose,[slot]:handle.fingerprint};saveState(market,target,record.state);}}catch{record.cleanupUnproven=true;}
        }}
        catch {record.checked[index]={market,environment,slot,status:'FAILED'};}
      })));
    };
    await recoverSlot('primary');
    await recoverSlot('second');
    await Promise.all(records.map(async record=>{
      record.final={market:record.market,status:'SKIPPED',published:false};
      if(record.failed)return;
      try {
        const human={...record.state.human};
        const handoff={...record.state.handoff};
        // A user may finish and export the preserved login before this cycle.
        // Fresh health then bypasses resume, but its own window still needs
        // deferred cleanup after package/publication, never before proof.
        for(const result of record.checked.filter(r=>r.status==='HEALTHY'&&human[r.slot])) {
          let handle;
          try {handle=await captureBrowser({market:record.market,environment:target,slot:result.slot});}
          catch {record.cleanupUnproven=true;}
          if(handle){record.resumeHandles||={};record.resumeHandles[result.slot]=handle;record.state.pendingClose={...record.state.pendingClose,[result.slot]:handle.fingerprint};}
        }
        for(const result of record.checked){if(result.status==='HUMAN_REQUIRED'||result.humanPending){human[result.slot]=true;handoff[result.slot]={passwordAttempted:result.passwordAttempted??handoff[result.slot]?.passwordAttempted??true,emailPhase:['READY','CHALLENGE'].includes(result.emailPhase)?result.emailPhase:'NONE'};}else if(['HEALTHY','RECOVERED'].includes(result.status)){delete human[result.slot];delete handoff[result.slot];}}
        record.state={...record.state,human,handoff};saveState(record.market,target,record.state);
        if(record.checked.every(r=>['HEALTHY','RECOVERED'].includes(r.status))) record.final=await finalize({market:record.market,environment:target,publish,env:record.env,state:record.state,beforeHash:record.beforeHash});
        if(record.final.status==='READY'&&record.cleanupUnproven)record.final={...record.final,status:'BROWSER_CLOSE_FAILED'};
        if(record.final.status==='READY'&&Object.keys(record.state.pendingClose||{}).length) {
          try {
          const pendingClose={...record.state.pendingClose};
          for(const [slot,fingerprint] of Object.entries(pendingClose)) {
            let handle=record.resumeHandles?.[slot];
            if(!handle)handle=await captureBrowser({market:record.market,environment:target,slot});
            try {if(handle&&handle.fingerprint===fingerprint)await handle.closeVerified();if(!handle&&!await browserClosed({market:record.market,environment:target,slot}))throw new Error('Retained browser closure is unproven.');delete pendingClose[slot];}
            finally {await handle?.dispose();if(record.resumeHandles)delete record.resumeHandles[slot];}
          }
          // The publisher may have acknowledged a new digest. Preserve that
          // checkpoint instead of overwriting it with the pre-publication copy.
          saveState(record.market,target,{...readState(record.market,target),pendingClose});
          } catch {record.final={...record.final,status:'BROWSER_CLOSE_FAILED'};}
        }
        notify({kind:'bundle',...record.final});
      } catch {fail(record);}
    }));
  } finally {
    for(const record of records)for(const handle of Object.values(record.resumeHandles||{}))try{await handle.dispose();}catch{}
    for(const record of records)try{record.release?.();}catch{fail(record);record.final={market:record.market,status:'SKIPPED',published:false};}
  }
  const identities=records.flatMap(r=>r.checked),finalized=records.map(r=>r.final||{market:r.market,status:'SKIPPED',published:false});
  for(const r of identities)log('[auth:keepalive] '+r.market.toUpperCase()+' '+r.slot+': '+r.status);
  for(const r of finalized)log('[auth:keepalive] '+r.market.toUpperCase()+' bundle: '+r.status+', publish='+(r.published?'updated':'unchanged'));
  const busy=identities.filter(r=>r.status==='BUSY'),blocking=identities.filter(r=>!['HEALTHY','RECOVERED','BUSY'].includes(r.status));
  return {environment:target,identities,finalized,blocking,busy,ok:blocking.length===0&&busy.length===0&&finalized.every(r=>r.status==='READY')};
}

module.exports = { MARKET_SLOTS, PACKAGE_SCRIPTS, PUBLISH_SCRIPTS, sessionBundlePath, fileHash, identityEnv, runNodeScript, verifyIdentity, recoverIdentity, resumeIdentity, packageAndPublishMarket, runKeepAliveCycle, readCheckpoint, saveCheckpoint, limitConcurrency };
