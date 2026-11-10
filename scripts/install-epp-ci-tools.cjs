const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function installArguments(lock){
 const root=lock.packages?.[''];
 if(!root)throw new Error('Versioned dependency lock is required.');
 const pinned=Object.keys({...root.dependencies,...root.devDependencies}).map(name=>{
  const version=lock.packages[`node_modules/${name}`]?.version;
  if(!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version||''))throw new Error('Direct dependency is not locked.');
  return `${name}@${version}`;
 });
 return ['install','--no-save','--package-lock=false','--ignore-scripts',...pinned,'allure-playwright@3.11.1','allure-commandline@2.43.0'];
}
function install(){
 const args=installArguments(JSON.parse(fs.readFileSync('package-lock.json','utf8')));
 const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const child=process.platform==='win32'
  ? spawnSync(process.execPath,[npmCli,...args],{stdio:'inherit',windowsHide:true})
  : spawnSync('npm',args,{stdio:'inherit',windowsHide:true});
 if(child.status!==0)throw new Error('Pinned EPP CI tool installation failed.');
 const expected=JSON.parse(fs.readFileSync('package-lock.json','utf8')).packages['node_modules/@playwright/test'].version;
 if(require('@playwright/test/package.json').version!==expected)throw new Error('Installed Playwright does not match the lockfile.');
}
if(require.main===module)try{install();}catch{console.error('[epp-ci] Dependency installation failed; lockfile preserved.');process.exitCode=1;}
module.exports={installArguments,install};
