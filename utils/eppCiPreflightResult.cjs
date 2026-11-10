const fs=require('node:fs'),path=require('node:path');
const auth=new Set(['EPP_IDENTITY_REQUIRED','SERVER_USER_ANONYMOUS','AUTH_OR_ENTITLEMENT_REQUIRED','CORPORATE_ACTIVATION_REQUIRED','SAMSUNG_ACCOUNT_SECURITY_BLOCKED','AUTHORIZATION_EXPIRED','SERVER_IDENTITY_MISMATCH','EPP_ENTITLEMENT_NOT_PROVEN']);
function failureType(error){return auth.has(error?.eppReason)?'AUTH_BLOCKED':error?.eppReason==='VERIFICATION_CODE_REJECTED'?'TEST_DATA_REQUIRED':'INFRA_ERROR';}
function writePreflightResult(config,env,error=null,io=fs){
 if(!env.EPP_CI_PREFLIGHT_FILE)return;
 const expected=path.resolve(path.dirname(env.PLAYWRIGHT_JSON_OUTPUT_FILE||''),'preflight.json');
 if(env.CI!=='1'||config.environment!=='S2'||path.resolve(env.EPP_CI_PREFLIGHT_FILE)!==expected||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(env.EPP_RUN_ID||''))throw new Error('Invalid EPP CI preflight result scope.');
 const reason=error&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.eppReason||'')?error.eppReason:null;
 const result={market:config.market,environment:'S2',program:config.program,runId:env.EPP_RUN_ID,ok:!error,type:error?failureType(error):'VERIFIED',reason};
 io.mkdirSync(path.dirname(expected),{recursive:true});io.writeFileSync(expected,JSON.stringify(result));return result;
}
function readPreflightResult(manifest,io=fs){
 try{const result=JSON.parse(io.readFileSync(path.join(manifest.output,'preflight.json'),'utf8'));if(['market','environment','program','runId'].some(k=>result[k]!==manifest[k]))return null;return result;}catch{return null;}
}
module.exports={failureType,writePreflightResult,readPreflightResult};
