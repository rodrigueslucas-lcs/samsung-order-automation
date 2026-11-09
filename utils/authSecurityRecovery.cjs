// A provider denial gets one delayed automatic recovery, never an endless login loop.
const SECURITY_RETRY_DELAY_MS=60*60*1000;
function canRetrySecurityDenial({observedAt,automaticAttemptedAt,operatorRequested=false,now=Date.now()}){
 if(operatorRequested)return true;
 const observed=Date.parse(observedAt);
 return !automaticAttemptedAt&&Number.isFinite(observed)&&observed<=now&&now-observed>=SECURITY_RETRY_DELAY_MS;
}
module.exports={canRetrySecurityDenial,SECURITY_RETRY_DELAY_MS};
