const {resumeHumanHandoff}=require('../utils/authHumanHandoff.cjs');
async function main() {
  const result=await resumeHumanHandoff({market:process.env.AUTH_MARKET_LEASE_MARKET,environment:process.env.AUTH_MARKET_LEASE_ENVIRONMENT,slot:process.env.AUTH_REFRESH_SLOT,passwordAttempted:process.env.AUTH_HANDOFF_PASSWORD_ATTEMPTED!=='0',emailPhase:process.env.AUTH_HANDOFF_EMAIL_PHASE||'NONE'});
  console.log('AUTH_HANDOFF_AUDIT '+JSON.stringify({passwordAttempted:result.passwordAttempted,emailPhase:result.emailPhase||'NONE'}));
  console.log('[auth:resume] Retained human handoff: '+result.status+'. No browser or login was restarted.');
  return result.status==='EXPORTED'?0:result.status==='HUMAN_REQUIRED'?2:22;
}
main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('[auth:resume] Retained handoff could not be proven.');process.exitCode=22;});
