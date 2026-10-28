const {repairResourceOrigin,stableResourceAddress}=require('../utils/authOperationsResource.cjs');
const args=process.argv.slice(2);
if(args.some(a=>a!=='--apply'))throw new Error('Unsupported resource-repair option.');
Promise.resolve().then(()=>repairResourceOrigin({apply:args.includes('--apply'),resourceAddress:stableResourceAddress()})).then(result=>console.log('[auth:operations:resource] '+JSON.stringify(result))).catch(error=>{console.error('[auth:operations:resource] '+(error.code||'REPAIR_UNPROVEN'));process.exitCode=1;});
