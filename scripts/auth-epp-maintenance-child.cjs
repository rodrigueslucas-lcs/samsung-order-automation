const {refresh}=require('./auth-refresh-epp.cjs');
refresh(process.env.EPP_KEEPALIVE_MARKET,process.env.EPP_KEEPALIVE_ENVIRONMENT).then(()=>{
  console.log('EPP_AUTH_RESULT '+JSON.stringify({status:'REFRESHED'}));
}).catch(error=>{
  const status=error.exitCode===79?'HUMAN_REQUIRED':error.exitCode===78?'BLOCKED':error.code==='AUTH_BUSY'?'BUSY':'UNPROVEN';
  const reason=/^[A-Z_0-9]+$/.test(error.eppReason||'')?error.eppReason:'EPP_REFRESH_NOT_PROVEN';
  // Diagnostic metadata only. Whitelist phase and error class; never emit
  // URLs, provider error messages, credentials or browser state.
  const phase=/^[A-Z_]{3,48}$/.test(error.eppStage||'')?error.eppStage:'PRECONDITIONS';
  const kind=['TimeoutError','TypeError','ReferenceError','Error'].includes(error.name)?error.name:'UNKNOWN';
  console.log('EPP_AUTH_RESULT '+JSON.stringify({status,reason,phase,kind}));
  process.exitCode=error.exitCode||1;
});
