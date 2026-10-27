const fs=require('node:fs');
const path=require('node:path');
const {getEppSessionPaths}=require('./eppSession.cjs');
function beginEppOrderAttempt(config,kind,{io=fs,now=()=>new Date().toISOString()}={}){
 if(!['card','cash'].includes(kind))throw new Error('Unsupported EPP payment attempt.');
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
module.exports={beginEppOrderAttempt,pendingEppOrderAttempt,confirmPendingEppOrder};
