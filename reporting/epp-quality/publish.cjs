const fs=require('node:fs'),path=require('node:path');
const redaction=require('./redact.cjs');
function publishSafeArtifacts(output,values=[],io=fs){
 const root=io.realpathSync(output),target=path.join(root,'public');
 if(io.existsSync(target)&&io.realpathSync(target)!==target)throw new Error('Unsafe EPP public artifact root.');
 io.mkdirSync(target,{recursive:true});
 const counts={copied:0,omitted:0};
 function copy(source,destination){
  const info=io.lstatSync(source);if(info.isSymbolicLink())throw new Error('EPP diagnostic link cannot be published.');
  if(info.isDirectory()){io.mkdirSync(destination,{recursive:true});for(const name of io.readdirSync(source))copy(path.join(source,name),path.join(destination,name));return;}
  const ext=path.extname(source).toLowerCase(),body=io.readFileSync(source);let safe;
  if(ext==='.json')safe=redaction.redactJsonText(body.toString('utf8'),values);
  else if(ext==='.zip')safe=redaction.redactZip(body,{trace:true,values});
  else if(ext==='.html')safe=redaction.redactHtml(body.toString('utf8'),values);
  else if(['.txt','.log','.properties'].includes(ext))safe=redaction.redactText(body.toString('utf8'),values);
  // JavaScript/CSS/fonts are static reporter assets, not recorded input data.
  else if(['.js','.css','.woff','.woff2','.svg','.png','.jpg','.jpeg','.ico'].includes(ext))safe=body;
  else{counts.omitted++;return;}
  io.writeFileSync(destination,safe);counts.copied++;
 }
 for(const name of ['quality','html','allure','allure-report','playwright','evidence','results.json','execution.json']){
  const source=path.join(root,name);if(io.existsSync(source))copy(source,path.join(target,name));
 }
 io.writeFileSync(path.join(target,'publication.json'),JSON.stringify({schemaVersion:1,sanitized:true,rawStatusesPreserved:true,...counts}));
 return{target,...counts};
}
module.exports={publishSafeArtifacts};
