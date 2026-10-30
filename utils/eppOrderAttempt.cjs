const fs=require('node:fs');
const path=require('node:path');
const {getEppSessionPaths}=require('./eppSession.cjs');
function beginEppOrderAttempt(config,kind,{io=fs,now=()=>new Date().toISOString()}={}){
 if(!['card','cash','transfer'].includes(kind))throw new Error('Unsupported EPP payment attempt.');
 const directory=getEppSessionPaths(config).directory;
 io.mkdirSync(directory,{recursive:true});
 const filename=path.join(directory,`order-attempt-${kind}.json`);
 const record={market:config.market,environment:config.environment,kind,status:'SUBMITTING',at:now()};
 try{io.writeFileSync(filename,JSON.stringify(record),{flag:'wx'});}catch(error){if(error.code==='EEXIST')throw new Error('AMBIGUOUS_EPP_ORDER_ATTEMPT: inspect the existing attempt before creating another order.');throw error;}
 return{observe(orderCode){
  if(!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(orderCode))throw new Error('Invalid observed EPP order identity.');
  io.writeFileSync(filename,JSON.stringify({...record,status:'OBSERVED_ORDER',orderCode}));
 },confirm(orderCode){
  if(!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(orderCode))throw new Error('Invalid confirmed EPP order identity.');
  io.writeFileSync(filename,JSON.stringify({...record,status:'CONFIRMED',orderCode}));
  io.renameSync(filename,path.join(directory,`confirmed-${kind}-${orderCode}.json`));
 }};
}
function pendingEppOrderAttempt(config,kind,io=fs){
 const filename=path.join(getEppSessionPaths(config).directory,`order-attempt-${kind}.json`);
 if(!io.existsSync(filename))return null;
 let record;
 try{record=JSON.parse(io.readFileSync(filename,'utf8'));}catch{throw new Error('EPP attempt record is unreadable; inspect it locally before any new submit.');}
 if(record.market!==config.market||record.environment!==config.environment||record.kind!==kind)throw new Error('EPP attempt identity mismatch.');
 if(!['SUBMITTING','OBSERVED_ORDER'].includes(record.status)||record.orderCode&&!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(record.orderCode))throw new Error('EPP attempt state is invalid; no new submit is allowed.');
 return record;
}
function confirmPendingEppOrder(config,kind,orderCode,io=fs){
 const record=pendingEppOrderAttempt(config,kind,io);
 if(!record||record.orderCode!==orderCode)throw new Error('Pending EPP order does not match confirmation.');
 const directory=getEppSessionPaths(config).directory,filename=path.join(directory,`order-attempt-${kind}.json`);
 io.writeFileSync(filename,JSON.stringify({...record,status:'CONFIRMED'}));
 io.renameSync(filename,path.join(directory,`confirmed-${kind}-${orderCode}.json`));
}
function observePendingEppOrder(config,kind,orderCode,io=fs){
 const record=pendingEppOrderAttempt(config,kind,io);
 if(!record||!new RegExp(`^${config.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(orderCode)||(record.orderCode&&record.orderCode!==orderCode))throw new Error('Pending EPP observation requires its own reconciled order.');
 io.writeFileSync(path.join(getEppSessionPaths(config).directory,`order-attempt-${kind}.json`),JSON.stringify({...record,status:'OBSERVED_ORDER',orderCode}));
}
function latestConfirmedEppOrder(config,kind='card',io=fs){
 if(!['card','cash','transfer'].includes(kind))throw new Error('Unsupported EPP payment attempt.');
 const directory=getEppSessionPaths(config).directory;
 if(!io.existsSync(directory))return null;
 const names=io.readdirSync(directory).filter(name=>new RegExp(`^confirmed-${kind}-${config.market}\\d{6}-\\d{8}(?:_\\d+)?\\.json$`).test(name));
 const records=names.map(name=>{
  const record=JSON.parse(io.readFileSync(path.join(directory,name),'utf8'));
  if(record.status!=='CONFIRMED'||record.market!==config.market||record.environment!==config.environment||record.kind!==kind||name!==`confirmed-${kind}-${record.orderCode}.json`||!Number.isFinite(Date.parse(record.at)))throw new Error('Confirmed EPP order record is invalid; no submit is allowed.');
  return record;
 });
 return records.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;
}
module.exports={beginEppOrderAttempt,pendingEppOrderAttempt,confirmPendingEppOrder,observePendingEppOrder,latestConfirmedEppOrder};
