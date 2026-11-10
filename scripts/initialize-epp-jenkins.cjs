const fs=require('node:fs'),path=require('node:path');
const programmes={MX:'pymesmx',PE:'pe_membership_vip',CO:'co_epp_agre',CL:'alianzas'};
function initialize(env=process.env,workspace=process.cwd(),io=fs){
 const market=env.TEST_MARKET;
 if(env.CI!=='1'||env.ENVIRONMENT!=='S2'||!programmes[market]||!/^\d+$/.test(env.BUILD_NUMBER||''))throw new Error('Invalid EPP initialization scope.');
 const runId=`ci-${env.BUILD_NUMBER}-${Date.now()}`,relativeOutput=`test-results/epp/${market.toLowerCase()}/s2/${runId}`;
 const manifest={market,environment:'S2',program:programmes[market],buildNumber:env.BUILD_NUMBER,runId,relativeOutput,output:path.resolve(workspace,relativeOutput),privateOutput:require('../utils/eppCiWorkspace.cjs').privateRunDirectory(market,runId,env,workspace),authorityRoot:null,initializedOnly:true};
 io.mkdirSync(path.join(workspace,'test-results'),{recursive:true});io.writeFileSync(path.join(workspace,'test-results/epp-ci-current.json'),JSON.stringify(manifest));
 return manifest;
}
if(require.main===module)try{initialize();}catch{console.error('[epp-ci] Build context initialization failed.');process.exitCode=1;}
module.exports={initialize};
