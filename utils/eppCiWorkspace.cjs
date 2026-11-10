const path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
function privateRunDirectory(market,runId,env=process.env,workspace=process.cwd()){
 if(!['MX','PE','CO','CL'].includes(market)||!/^[A-Za-z0-9][A-Za-z0-9.-]{0,119}$/.test(runId||''))throw new Error('Invalid private EPP execution identity.');
 const base=path.resolve(env.WORKSPACE_TMP||path.join(os.tmpdir(),'SamsungSMB-EppCI',crypto.createHash('sha256').update(path.resolve(workspace)).digest('hex').slice(0,16)));
 const relative=path.relative(path.resolve(workspace),base);
 if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Private EPP diagnostics must be outside the browsable workspace.');
 return path.join(base,`epp-${market.toLowerCase()}-${runId}`);
}
function validatePrivateOutput(manifest,env=process.env,workspace=process.cwd()){
 const expected=privateRunDirectory(manifest.market,manifest.runId,env,workspace);
 if(manifest.privateOutput!==expected)throw new Error('Private EPP execution directory mismatch.');return expected;
}
module.exports={privateRunDirectory,validatePrivateOutput};
