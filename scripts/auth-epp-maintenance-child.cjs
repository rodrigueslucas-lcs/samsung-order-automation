const {refresh}=require('./auth-refresh-epp.cjs');
refresh(process.env.EPP_KEEPALIVE_MARKET,process.env.EPP_KEEPALIVE_ENVIRONMENT).then(()=>{
  console.log('EPP_AUTH_RESULT '+JSON.stringify({status:'REFRESHED'}));
}).catch(error=>{
  const status=error.exitCode===79?'HUMAN_REQUIRED':error.exitCode===78?'BLOCKED':error.code==='AUTH_BUSY'?'BUSY':'UNPROVEN';
  const reason=/^[A-Z_0-9]+$/.test(error.eppReason||'')?error.eppReason:'EPP_REFRESH_NOT_PROVEN';
  console.log('EPP_AUTH_RESULT '+JSON.stringify({status,reason}));
  process.exitCode=error.exitCode||1;
});
