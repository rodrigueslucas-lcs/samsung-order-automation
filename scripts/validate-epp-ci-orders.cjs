const fs=require('node:fs'),path=require('node:path');
function validate(env=process.env){
 const manifest=JSON.parse(fs.readFileSync('test-results/epp-ci-current.json','utf8'));
 require('./finalize-epp-jenkins.cjs').validateManifest(manifest,env);
 const output=require('../utils/eppCiWorkspace.cjs').validatePrivateOutput(manifest,env);
 let document=null;try{document=JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8'));}catch{}
 const evidence=require('../utils/eppCiOrderEvidence.cjs').validateOrderEvidence(manifest,document);
 fs.writeFileSync('test-results/epp-ci-payment-validation.json',JSON.stringify(evidence,null,2));
 console.log(`[epp-ci] read-only order validation ${evidence.state}; proven new orders ${evidence.orders.length}; no submit performed`);
 return Object.keys(evidence.errors).length?1:0;
}
if(require.main===module){try{process.exitCode=validate();}catch{console.error('[epp-ci] Causal order validation unavailable; no financial action performed.');process.exitCode=1;}}
module.exports={validate};
