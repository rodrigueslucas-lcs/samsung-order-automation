const fs=require('node:fs');
const defects={
 'SAM-25046':{market:'MX',program:'pymesmx',jira:'RT-779284',signature:'MX_EPP_CASH_TRANSACTION_FAILED pymesmx'},
 'SAM-24865':{market:'CL',program:'alianzas',jira:'SAM-25161',signature:'CL_EPP_BANK_FORBIDDEN_403'}
};
async function attachRegisteredPaymentDefect(config,tc,info){
 const d=defects[tc];if(!d||config.environment!=='S2'||config.market!==d.market||config.program!==d.program)return null;
 const record={market:d.market,environment:'S2',program:d.program,tc,jira:d.jira,url:'https://jira.secext.samsung.net/browse/'+d.jira,signature:d.signature,source:'OPERATOR_CONFIRMED_REPRODUCTION',execution:'QUARANTINED_NOT_REEXECUTED',submitCount:0,note:'Registered application defect. No new financial attempt. Prior initiation records are preserved; this evidence does not reconcile them.'};
 const file=info.outputPath('registered-payment-defect.json');fs.writeFileSync(file,JSON.stringify(record,null,2));
 await info.attach('Registered operator reproduction (not a new runtime submit)',{path:file,contentType:'application/json'});
 info.annotations.push({type:'known-defect',description:d.jira+': '+d.signature+'; registered operator reproduction; no new submit.'});
 return 'ENVIRONMENT_DEFECT: '+d.signature+' — '+d.jira+'. Operator-confirmed quarantine, not reexecuted. Previous initiation records remain protected.';
}
module.exports={attachRegisteredPaymentDefect};
