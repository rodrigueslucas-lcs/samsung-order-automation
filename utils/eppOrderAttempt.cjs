const fs=require('node:fs');
const path=require('node:path');
const {getEppSessionPaths}=require('./eppSession.cjs');
const {financialDirectory}=require('./eppCiAuthority.cjs');
const attemptDirectory=config=>financialDirectory(config,getEppSessionPaths(config).directory);
function archiveConfirmedAttempt(source,target,io){
 for(let n=0;n<7;n++){
  try{io.renameSync(source,target);return;}
  catch(error){if(!['EBUSY','EPERM','EACCES'].includes(error.code)||n===6)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*2**n);}
 }
}
function beginEppOrderAttempt(config,kind,{io=fs,now=()=>new Date().toISOString(),runId=process.env.EPP_RUN_ID}={}){
 if(!['card','cash','transfer'].includes(kind))throw new Error('Unsupported EPP payment attempt.');
 const directory=attemptDirectory(config);
 io.mkdirSync(directory,{recursive:true});
 const filename=path.join(directory,`order-attempt-${kind}.json`);
 if(runId!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(runId))throw new Error('Invalid EPP execution identity.');
 const record={market:config.market,environment:config.environment,kind,status:'SUBMITTING',at:now(),...(runId?{runId}:{})};
 try{io.writeFileSync(filename,JSON.stringify(record),{flag:'wx'});}catch(error){if(error.code==='EEXIST')throw new Error('AMBIGUOUS_EPP_ORDER_ATTEMPT: inspect the existing attempt before creating another order.');throw error;}
 return{observe(orderCode){
  if(!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(orderCode))throw new Error('Invalid observed EPP order identity.');
  io.writeFileSync(filename,JSON.stringify({...record,status:'OBSERVED_ORDER',orderCode}));
 },confirm(orderCode){
  if(!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(orderCode))throw new Error('Invalid confirmed EPP order identity.');
  io.writeFileSync(filename,JSON.stringify({...record,status:'CONFIRMED',orderCode}));
  archiveConfirmedAttempt(filename,path.join(directory,`confirmed-${kind}-${orderCode}.json`),io);
 }};
}
function pendingEppOrderAttempt(config,kind,io=fs){
 const filename=path.join(attemptDirectory(config),`order-attempt-${kind}.json`);
 if(!io.existsSync(filename))return null;
 let record;
 try{record=JSON.parse(io.readFileSync(filename,'utf8'));}catch{throw new Error('EPP attempt record is unreadable; inspect it locally before any new submit.');}
 if(record.market!==config.market||record.environment!==config.environment||record.kind!==kind)throw new Error('EPP attempt identity mismatch.');
 if(!['SUBMITTING','OBSERVED_ORDER','CONFIRMED'].includes(record.status)||record.orderCode&&!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$','i').test(record.orderCode))throw new Error('EPP attempt state is invalid; no new submit is allowed.');
 if(record.status==='CONFIRMED'){
  if(!record.orderCode)throw new Error('Confirmed EPP attempt has no causal order.');
  archiveConfirmedAttempt(filename,path.join(attemptDirectory(config),`confirmed-${kind}-${record.orderCode}.json`),io);
  return null;
 }
 return record;
}
function confirmPendingEppOrder(config,kind,orderCode,io=fs){
 const record=pendingEppOrderAttempt(config,kind,io);
 if(!record||record.orderCode!==orderCode)throw new Error('Pending EPP order does not match confirmation.');
 const directory=attemptDirectory(config),filename=path.join(directory,`order-attempt-${kind}.json`);
 io.writeFileSync(filename,JSON.stringify({...record,status:'CONFIRMED'}));
 archiveConfirmedAttempt(filename,path.join(directory,`confirmed-${kind}-${orderCode}.json`),io);
}
function observePendingEppOrder(config,kind,orderCode,io=fs){
 const record=pendingEppOrderAttempt(config,kind,io);
 if(!record||!new RegExp(`^${config.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(orderCode)||(record.orderCode&&record.orderCode!==orderCode))throw new Error('Pending EPP observation requires its own reconciled order.');
 io.writeFileSync(path.join(attemptDirectory(config),`order-attempt-${kind}.json`),JSON.stringify({...record,status:'OBSERVED_ORDER',orderCode}));
}
function latestConfirmedEppOrder(config,kind='card',io=fs,{runId}={}){
 if(!['card','cash','transfer'].includes(kind))throw new Error('Unsupported EPP payment attempt.');
 const directory=attemptDirectory(config);
 if(!io.existsSync(directory))return null;
 const names=io.readdirSync(directory).filter(name=>new RegExp(`^confirmed-${kind}-${config.market}\\d{6}-\\d{8}(?:_\\d+)?\\.json$`).test(name));
 const records=names.map(name=>{
  const record=JSON.parse(io.readFileSync(path.join(directory,name),'utf8'));
  if(record.status!=='CONFIRMED'||record.market!==config.market||record.environment!==config.environment||record.kind!==kind||name!==`confirmed-${kind}-${record.orderCode}.json`||!Number.isFinite(Date.parse(record.at)))throw new Error('Confirmed EPP order record is invalid; no submit is allowed.');
  return record;
 });
 return records.filter(record=>!runId||record.runId===runId).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;
}
function confirmedEppOrderForRun(config,runId,io=fs){
 if(typeof runId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(runId))throw new Error('CURRENT_RUN_ORDER_REQUIRED: a local EPP campaign identity is required.');
 return latestConfirmedEppOrder(config,'card',io,{runId})||latestConfirmedEppOrder(config,'transfer',io,{runId});
}
function archiveRejectedEppOrderAttempt(config,kind,evidence,io=fs){
 const record=pendingEppOrderAttempt(config,kind,io);
 if(!record||record.status!=='SUBMITTING'||record.orderCode||evidence?.market!==config.market||evidence?.environment!==config.environment||evidence?.program!==config.program||evidence?.attemptAt!==record.at||evidence?.providerBusinessCode!==601||evidence?.readOnly!==true||evidence?.historyComplete!==true||!Array.isArray(evidence.candidates)||evidence.candidates.length)throw new Error('Rejected EPP attempt requires its own conclusive provider rejection and complete empty causal history.');
 const directory=attemptDirectory(config),source=path.join(directory,`order-attempt-${kind}.json`),target=path.join(directory,`rejected-${kind}-${Date.parse(record.at)}.json`);
 if(!Number.isFinite(Date.parse(record.at))||io.existsSync(target))throw new Error('Rejected EPP attempt archive is not safe to overwrite.');
 io.writeFileSync(source,JSON.stringify({...record,status:'REJECTED',reason:'PAYMENT_REJECTED_601',historyComplete:true,reconciledAt:new Date().toISOString()}));
 io.renameSync(source,target);
 return{status:'REJECTED',submitRetried:false};
}
function recordClFlowConfirmationSubmitted(config,orderCode,io=fs){
 const record=pendingEppOrderAttempt(config,'transfer',io);
 if(config.market!=='CL'||config.environment!=='S2'||!record||record.status!=='OBSERVED_ORDER'||record.orderCode!==orderCode)throw new Error('Flow confirmation must belong to the observed CL transfer.');
 io.writeFileSync(path.join(attemptDirectory(config),'order-attempt-transfer.json'),JSON.stringify({...record,providerConfirmationSubmitted:true}));
}
module.exports={beginEppOrderAttempt,pendingEppOrderAttempt,confirmPendingEppOrder,observePendingEppOrder,latestConfirmedEppOrder,confirmedEppOrderForRun,archiveRejectedEppOrderAttempt,recordClFlowConfirmationSubmitted};
