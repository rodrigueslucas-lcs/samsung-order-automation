// One-command S2 EPP refresh for the four explicitly selected operational programmes.
// Reuses the existing guarded maintenance flow (Jenkins idle, leases, verify-first,
// CAPTCHA handoff, programme policy, staging-only navigation, publish).
const {main:keepAliveMain}=require('./auth-epp-keepalive-once.cjs');
const {getEppConfig}=require('../config/markets/epp.js');

const PRIMARY_PROGRAMMES=Object.freeze({
  MX:'pymesmx',
  PE:'pe_membership_vip',
  CO:'co_epp_agre',
  CL:'alianzas',
});
const MARKETS=Object.keys(PRIMARY_PROGRAMMES);

function buildEnvironment(source=process.env){
  const env={...source,ENVIRONMENT:'S2'};
  for(const market of MARKETS){
    env[`${market}_QST_ENVIRONMENT`]='S2';
    env[`${market}_EPP_PROGRAM`]=PRIMARY_PROGRAMMES[market];
    const config=getEppConfig(market,env);
    if(config.environment!=='S2'||config.program!==PRIMARY_PROGRAMMES[market]){
      throw new Error(`Incorrect S2 EPP programme selection for ${market}.`);
    }
  }
  return env;
}

async function main({run=keepAliveMain,env=process.env,log=console.log}={}){
  const scoped=buildEnvironment(env);
  log('[auth:refresh:epp:all] S2 · MX pymesmx · PE pe_membership_vip · CO co_epp_agre · CL alianzas');
  log('[auth:refresh:epp:all] Verify first; recover only when authorized; publish only proven sessions.');
  return run({
    argv:['--environment=S2','--markets=MX,PE,CO,CL','--slot=primary','--allow-refresh','--publish'],
    env:scoped,
  });
}

if(require.main===module){
  main().then(code=>{process.exitCode=code;}).catch(error=>{
    console.error('[auth:refresh:epp:all] FAILED · '+String(error.message||error).split('\n')[0]);
    process.exitCode=1;
  });
}
module.exports={PRIMARY_PROGRAMMES,MARKETS,buildEnvironment,main};
