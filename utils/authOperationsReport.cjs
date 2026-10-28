const path=require('node:path');const fs=require('node:fs');
const REPORT='_f09f9490_20Samsung_20SMB_20_c2b7_20Auth_20Operations_20Dashboard';
function reportDirectory(value){
  if(typeof value!=='string'||!path.isAbsolute(value))throw Error('Observer report must be an absolute managed directory.');
  const normalized=path.resolve(value).replaceAll('\\','/');
  if(!normalized.toLowerCase().endsWith(('/jobs/Samsung-SMB-Auth-Operations/htmlreports/'+REPORT).toLowerCase()))throw Error('Only the current Auth Operations report can be updated.');
  return path.resolve(value);
}
function configuredReport(root,read=file=>JSON.parse(fs.readFileSync(file,'utf8')),{requireEnabled=true}={}){
  const file=path.resolve(root,'playwright/.auth/auth-operations-report.local.json');
  try{const config=read(file);if(requireEnabled&&config.enabled!==true)return null;return reportDirectory(config.directory);}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
module.exports={REPORT,reportDirectory,configuredReport};
