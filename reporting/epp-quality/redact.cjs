const {unzipSync,zipSync,strFromU8,strToU8}=require('fflate');
const hidden='[REDACTED]';
const sensitive=/password|passwd|cookie|token|authorization|secret|credential|storageState|sessionStorage|localStorage|cvv|cvc|cardNumber|securityCode|accountUid|userId/i;
function redactText(text,values=[]){
 let result=String(text);
 for(const value of [...new Set(values)].filter(v=>typeof v==='string'&&v.length>=3).sort((a,b)=>b.length-a.length)){
  const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  result=result.replace(new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`,'g'),hidden);
 }
 return result.replace(/[^\s<>"'@]+@[^\s<>"'@]+\.[A-Za-z]{2,}/g,hidden)
  .replace(/(?<![A-Za-z0-9_])(?:\d[ -]?){12,18}\d(?![A-Za-z0-9_])/g,hidden)
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,hidden)
  .replace(/\bBearer\s+[^\s"',;]+/gi,'Bearer '+hidden)
  .replace(/(\b(?:password|token|secret|authorization|cookie)\s*[=:]\s*)[^\s"'<>]+/gi,'$1'+hidden)
  .replace(/\b(?:Fill|fill|filling|typing|typed)\s+["'][^"'\n]*["']/g,'Fill "'+hidden+'"')
  .replace(/https?:\/\/[^\s<>"']+/g,value=>{try{const url=new URL(value);url.search='';url.hash='';url.pathname=url.pathname.replace(/\/users\/[^/]+/g,'/users/[identity]');return url.href;}catch{return hidden;}});
}
function redactObject(value,values=[],depth=0){
 if(depth>80)throw new Error('EPP diagnostic nesting exceeds safe publication limits.');
 if(typeof value==='string')return /^(?:MX|PE|CO|CL)\d{6}-\d{8}(?:_\d+)?$/.test(value)?value:redactText(value,values);
 if(Array.isArray(value))return value.map(v=>redactObject(v,values,depth+1));
 if(!value||typeof value!=='object')return value;
 const result={};
 for(const [key,item] of Object.entries(value))result[key]=sensitive.test(key)?hidden:redactObject(item,values,depth+1);
 if(typeof value.name==='string'&&sensitive.test(value.name)&&'value' in value)result.value=hidden;
 if(typeof value.k==='string'&&sensitive.test(value.k)&&'v' in value)result.v=hidden;
 if('log' in result)result.log=[];
 if(/fill|type|insertText|evaluate|addInitScript|storageState|cookies/i.test(String(value.method||''))&&value.params)result.params={redacted:true};
 if(result.request&&typeof result.request==='object'){
  result.request.headers=[];result.request.cookies=[];
  if(result.request.postData)result.request.postData={mimeType:'text/plain',text:hidden};
 }
 if(result.response&&typeof result.response==='object'){
  result.response.headers=[];result.response.cookies=[];
  if(result.response.content)result.response.content={mimeType:result.response.content.mimeType,size:result.response.content.size};
 }
 return result;
}
function redactJsonText(text,values=[]){return JSON.stringify(redactObject(JSON.parse(text),values));}
function redactZip(bytes,{trace=false,values=[]}={}){
 let size=0;const max=100*1024*1024;
 if(bytes.length>max)throw new Error('EPP diagnostic archive too large.');
 const entries=unzipSync(bytes,{filter:file=>{size+=file.originalSize;if(size>max)throw new Error('EPP expanded diagnostic archive too large.');return true;}}),output={};
 for(const [name,body] of Object.entries(entries)){
  if(name.startsWith('/')||name.split(/[\\/]/).includes('..'))throw new Error('Unsafe diagnostic archive path.');
  if(trace){
   if(!/\.(?:trace|network|stacks)$/.test(name))continue;
   const text=strFromU8(body);let records;try{records=[JSON.parse(text)];}catch{records=text.split('\n').filter(Boolean).map(line=>JSON.parse(line));}
   const lines=records.filter(record=>record.type!=='console'&&record.type!=='event').map(record=>{
    const clean=redactObject(record,values);
    if(record.type==='before'&&clean.params)clean.params=Object.fromEntries(Object.entries(clean.params).filter(([key,value])=>['selector','url','timeout','strict','button','key'].includes(key)&&(typeof value==='string'||typeof value==='number'||typeof value==='boolean')));
    if(record.type==='after')delete clean.result;
    return JSON.stringify(clean);
   });output[name]=strToU8(lines.join('\n')+'\n');
  }else if(/\.json$/i.test(name))output[name]=strToU8(redactJsonText(strFromU8(body),values));
  else if(/\.zip$/i.test(name))output[name]=redactZip(body,{trace:true,values});
  else if(/\.(?:txt|log|properties)$/i.test(name))output[name]=strToU8(redactText(strFromU8(body),values));
  else if(/\.(?:png|jpe?g|woff2?|svg)$/i.test(name))output[name]=body;
 }
 return zipSync(output);
}
function redactHtml(html,values=[]){
 // Static reporter JavaScript is kept byte-for-byte. Results live in the ZIP,
 // not in the application's source code; redacting source breaks the viewer.
 return html.replace(/(window\.playwrightReportBase64\s*=\s*["'])([^"']+)(["'])/g,(_all,start,value,end)=>{
  const prefix=value.startsWith('data:application/zip;base64,')?'data:application/zip;base64,':'';
  const bytes=Buffer.from(prefix?value.slice(prefix.length):value,'base64');
  return start+prefix+Buffer.from(redactZip(bytes,{values})).toString('base64')+end;
 });
}
function secretValues(data,result=[]){
 if(!data||typeof data!=='object')return result;
 for(const [key,value] of Object.entries(data)){
  if(value&&typeof value==='object')secretValues(value,result);
  else if(typeof value==='string'&&/^(?:number|holderName|expiry|cvv|cvc|document|password|email|phone|firstName|lastName)$/i.test(key)&&value.length>=3)result.push(value);
 }
 return result;
}
module.exports={redactText,redactObject,redactJsonText,redactZip,redactHtml,secretValues};
