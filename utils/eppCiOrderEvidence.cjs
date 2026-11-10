const fs=require('node:fs');
const records=require('./eppOrderAttempt.cjs');
const payments={MX:{'SAM-25045':'card','SAM-25046':'cash'},PE:{'SAM-25138':'card'},CO:{'SAM-24953':'card'},CL:{'SAM-24864':'card','SAM-24865':'transfer'}};
const confirmations={PE:'SAM-25140',CL:'SAM-24866'};
function validateOrderEvidence(manifest,document,{io=fs,latest=records.latestConfirmedEppOrder,current=records.confirmedEppOrderForRun}={}){
 const result={market:manifest.market,environment:'S2',program:manifest.program,runId:manifest.runId,readOnly:true,state:'NOT_RUN',errors:{},orders:[]};
 if(!document)return result;
 const metadata=document.config?.metadata?.epp;
 if(!metadata||['market','environment','program','runId'].some(key=>metadata[key]!==manifest[key]))throw new Error('Order evidence belongs to another EPP execution.');
 if(metadata.executionMode==='RECOVERY_ONLY')return{...result,state:'RECOVERY_ONLY'};
 const config=require('../config/markets/epp').getEppConfig(manifest.market,{ENVIRONMENT:'S2',EPP_PROGRAM:manifest.program,EPP_AUTH_SLOT:'primary'});
 const env={CI:'1',ENVIRONMENT:'S2',EPP_CI_AUTHORITY_ROOT:manifest.authorityRoot};
 if(!require('./eppCiAuthority.cjs').authorityRoot(env))throw new Error('Authoritative EPP order records unavailable.');
 const passed=new Set();
 function visit(suites=[]){for(const suite of suites){for(const spec of suite.specs||[]){const id=spec.title?.match(/\bSAM-\d+\b/)?.[0];for(const test of spec.tests||[])if(test.results?.at(-1)?.status==='passed')passed.add(id);}visit(suite.suites);}}
 visit(document.suites);
 const identities=new Map();
 const add=(record,tc)=>{
  if(!record||record.runId!==manifest.runId)return false;
  if(record.market!==manifest.market||record.environment!=='S2'||record.status!=='CONFIRMED'||!new RegExp(`^${manifest.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(record.orderCode||''))throw new Error('Invalid causal EPP order record.');
  const publicOrderNumber=record.orderCode.replace(/_\d+$/,'');
  const existing=identities.get(record.orderCode);
  if(existing){if(!existing.tcs.includes(tc))existing.tcs.push(tc);}
  else {
   const item={publicOrderNumber,method:record.kind,tcs:[tc],runId:manifest.runId,confirmationValidated:true,newOrderInCurrentRun:true};
   identities.set(record.orderCode,item);result.orders.push(item);
  }
  return true;
 };
 for(const [tc,kind] of Object.entries(payments[manifest.market]||{}))if(passed.has(tc)&&!add(latest(config,kind,io,{runId:manifest.runId,env}),tc))result.errors[tc]='CURRENT_RUN_ORDER_REQUIRED';
 const confirmation=confirmations[manifest.market];
 if(confirmation&&passed.has(confirmation)&&!add(current(config,manifest.runId,io,env),confirmation))result.errors[confirmation]='CURRENT_RUN_ORDER_REQUIRED';
 result.state=Object.keys(result.errors).length?'FAILED':'VALIDATED';
 return result;
}
module.exports={validateOrderEvidence,payments,confirmations};
