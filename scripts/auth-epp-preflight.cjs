const fs=require('node:fs');
const {getEppConfig}=require('../config/markets/epp');
const sessions=require('../utils/eppSession.cjs');
const {validateBundle}=require('../utils/eppKeepAlive.cjs');
const {verifyEppSnapshot}=require('../utils/eppSessionVerification.cjs');
async function preflight(env=process.env){
  const config=getEppConfig(env.TEST_MARKET,env),lease=sessions.acquireEppLease(config,env);
  try{
    const snapshot=env.EPP_SESSION_BUNDLE_FILE?validateBundle(config,JSON.parse(fs.readFileSync(env.EPP_SESSION_BUNDLE_FILE,'utf8'))):sessions.loadEppSession(config);
    const verified=await verifyEppSnapshot(config,snapshot,{expectedEmail:sessions.getPrimaryEppCredentials(config).email});
    sessions.persistVerifiedEppSession(config,verified);
    console.log(`[EPP][${config.market}][${config.environment}][${config.authSlot}] KEEP_ALIVE_OK · verified session reused; no login`);
  }finally{lease.release();}
}
if(require.main===module)preflight().catch(error=>{console.error('[EPP] preflight BLOCKED · '+(error.eppReason||'SESSION_NOT_PROVEN')+'; no login or suite started');process.exitCode=1;});
module.exports={preflight};
