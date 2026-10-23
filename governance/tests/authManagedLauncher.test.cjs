const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function launch(market,environment,managed,slot='primary'){
 const output=[];let args;
 const hostname=environment==='S2'?'stg2.shop.samsung.com':'stg.shop.samsung.com';
 const config={name:environment,environment,hostname,baseUrl:new URL(`https://${hostname}/${market}/`),setupUrl:new URL(`https://${hostname}/getcookie.html`)};
 const child={once:(event,fn)=>{if(event==='spawn')fn();return child;},unref(){}};
 vm.runInNewContext(fs.readFileSync(`scripts/auth-open-profile-${market}.cjs`,'utf8'),{
  URL,console:{log:line=>output.push(line),error:()=>assert.fail('launcher error')},
  process:{platform:'win32',env:{LOCALAPPDATA:'C:/fixture',SAMSUNG_AUTH_MANAGED:managed?'1':'0',[`${market.toUpperCase()}_AUTH_SLOT`]:slot}},
  require:name=>{
   if(name==='node:fs')return {mkdirSync(){},existsSync:()=>true};
   if(name==='node:path')return path;
   if(name==='node:child_process')return {spawn:(_command,values)=>{args=values;return child;},spawnSync:()=>({status:0})};
   if(name.includes('mxConfig'))return {resolveMxEnvironment:()=>config};
   if(name.includes('config/markets/pe'))return {getPeQstConfig:()=>config};
   if(name.includes('config/markets/co'))return {getCoQstConfig:()=>config};
   throw Error('Unexpected dependency '+name);
  },
 });
 return {output:output.join('\n'),args};
}
for(const market of ['mx','pe','co'])for(const environment of ['S1','S2'])for(const managed of [false,true])test(`${market} ${environment} ${managed?'managed refresh':'standalone manual'} launch output matches its lifecycle`,()=>{
 const r=launch(market,environment,managed);
 assert.ok(r.args.includes('--start-maximized'));
 assert.ok(!r.args.some(arg=>arg.includes('auto-open-devtools')));
 if(managed){assert.match(r.output,/refresh will continue automatically/);assert.doesNotMatch(r.output,/Complete these steps manually|Run:.*auth:export/);}
 else assert.match(r.output,new RegExp(`auth:export:${market}`));
});
for(const market of ['mx','co'])for(const environment of ['S1','S2'])test(`${market} ${environment} managed SECOND retains its dedicated identity`,()=>{
 const r=launch(market,environment,true,'second');
 assert.ok(r.args.some(arg=>arg.startsWith('--user-data-dir=')&&arg.endsWith(`${environment.toLowerCase()}-${market}-second`)));
 assert.match(r.output,/second Chrome opened/);
});
