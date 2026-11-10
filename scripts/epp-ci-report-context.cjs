const fs=require('node:fs');
const {validateManifest}=require('./finalize-epp-jenkins.cjs');
const gates=['INFRA_ERROR','FAILED — NEW REGRESSION','BLOCKED BY EXTERNAL DEPENDENCIES','PASSED WITH KNOWN DEFECTS','FULLY PASSED','TARGETED PASSED'];
function reportContext(mode,env=process.env,io=fs,workspace=process.cwd()){
 const manifest=JSON.parse(io.readFileSync(require('node:path').join(workspace,'test-results/epp-ci-current.json'),'utf8'));
 validateManifest(manifest,env,workspace);
 if(mode==='output')return manifest.relativeOutput;
 if(mode!=='gate')throw new Error('Unsupported report-context field.');
 const gate=JSON.parse(io.readFileSync(require('node:path').join(workspace,'test-results/epp-ci-quality-gate.json'),'utf8'));
 if(gate.runId!==manifest.runId||!gates.includes(gate.gate))throw new Error('Quality gate belongs to another EPP execution.');
 return gate.gate;
}
if(require.main===module)try{console.log(reportContext(process.argv[2]));}catch{console.error('[epp-ci] Current-build report context rejected.');process.exitCode=1;}
module.exports={reportContext};
