const {repairResourceOrigin,stableResourceAddress}=require('../utils/authOperationsResource.cjs');

const FAILURE_RULES=[
  [/publisher.*configuration|Incomplete Jenkins publisher/i,'PUBLISHER_CONFIGURATION_MISSING'],
  [/Stable local IPv6 resource address was not proven/i,'LOCAL_IPV6_NOT_PROVEN'],
  [/Jenkins isolated resource redirect was not observed/i,'RESOURCE_REDIRECT_MISSING'],
  [/Invalid machine DNS name/i,'LOCAL_HOSTNAME_INVALID'],
  [/Resource address is not assigned to this machine/i,'RESOURCE_IP_NOT_LOCAL'],
  [/Resource hostname does not resolve exclusively to this machine/i,'RESOURCE_DNS_NOT_LOCAL'],
  [/Resource and credential-bearing Jenkins origins must stay distinct/i,'RESOURCE_ORIGIN_NOT_ISOLATED'],
  [/Stable resource hostname did not reach this Jenkins/i,'RESOURCE_ORIGIN_UNREACHABLE'],
  [/Jenkins crumb unavailable/i,'JENKINS_CRUMB_UNAVAILABLE'],
  [/Resource repair requires Jenkins Overall\/Administer/i,'JENKINS_ADMIN_REQUIRED'],
  [/Jenkins resource configuration was not acknowledged/i,'JENKINS_UPDATE_UNCONFIRMED'],
];

function safeFailure(error,phase){
  if(error?.code==='JENKINS_ADMIN_REQUIRED')return 'JENKINS_ADMIN_REQUIRED';
  const message=String(error?.message||'');
  for(const [pattern,code] of FAILURE_RULES)if(pattern.test(message))return code;
  if(phase==='SELECT_LOCAL_IP'){
    if(['ETIMEDOUT','ENOENT','EACCES'].includes(error?.code))return 'POWERSHELL_'+error.code;
    if(error?.status===2)return 'LOCAL_IPV6_NOT_AVAILABLE';
    if(error?.status!=null)return 'LOCAL_IPV6_SELECTION_FAILED';
  }
  if(['ECONNREFUSED','ENOTFOUND','ETIMEDOUT','EHOSTUNREACH'].includes(error?.cause?.code))return 'NETWORK_'+error.cause.code;
  return phase==='SELECT_LOCAL_IP'?'LOCAL_IP_SELECTION_UNPROVEN':'JENKINS_RESOURCE_REPAIR_UNPROVEN';
}

async function main({argv=process.argv.slice(2),select=()=>null,repair=repairResourceOrigin,log=console.log,error=console.error}={}){
  if(argv.some(a=>a!=='--apply'))throw new Error('Unsupported resource-repair option.');
  let resourceAddress;
  // Stable localhost <-> 127.0.0.1 isolation is the default. The selector
  // remains injectable for explicit diagnostics, never needed for normal use.
  try{resourceAddress=select();}
  catch(e){error('[auth:operations:resource] SELECT_LOCAL_IP · '+safeFailure(e,'SELECT_LOCAL_IP'));return 1;}
  try{
    const result=await repair({apply:argv.includes('--apply'),resourceAddress});
    log('[auth:operations:resource] '+JSON.stringify(result));
    return 0;
  }catch(e){error('[auth:operations:resource] CHECK_JENKINS_RESOURCE · '+safeFailure(e,'CHECK_JENKINS_RESOURCE'));return 1;}
}
if(require.main===module)main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('[auth:operations:resource] UNEXPECTED_FAILURE');process.exitCode=1;});
module.exports={safeFailure,main};
