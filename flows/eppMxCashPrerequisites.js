import {expect,test} from '@playwright/test';
import PaymentPage from '../pages/PaymentPage';

// Observe only the programme-bound details request. Never retain its credentials,
// checksum, merchant reference or configured buyer address in reporting.
export function watchMxEppCashDetails(page,cfg,{timeoutMs=30000}={}){
  let resolve,stopped=false;
  const pending=new Promise(done=>{resolve=done;});
  const listener=async response=>{
    const u=new URL(response.url());
    if(response.request().method()!=='GET'||u.origin!==`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`||u.pathname!=='/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes/mx-mercadoCash/details')return;
    let timer;
    try{
      const data=await Promise.race([response.json(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Body unavailable')),15000);})]);
      const params=new Map((Array.isArray(data.params)?data.params:[]).map(p=>[p.key,p.value?.value??p.value]));
      let banks=0;try{banks=Object.keys(JSON.parse(params.get('supportedBanks'))).length;}catch{}
      if(!stopped)resolve({http:response.status(),mode:data.code,submitEnabled:data.submitOrderEnabled===true,totalChanged:data.totalChanged===true,banks,testBuyer:typeof params.get('testUserEmailId')==='string'&&/@testuser\.com$/i.test(params.get('testUserEmailId'))});
    }catch{if(!stopped)resolve({unavailable:true});}finally{clearTimeout(timer);}
  };
  page.on('response',listener);
  return{wait:async()=>{let timer;try{return await Promise.race([pending,new Promise(done=>{timer=setTimeout(()=>done({unavailable:true}),timeoutMs);})]);}finally{clearTimeout(timer);}},stop:()=>{stopped=true;page.off('response',listener);}};
}

export async function inspectMxEppCash(page,cfg,capture,details){
  const blocked=(stage,detail)=>({status:'BLOCKED',reason:'PAYMENT_FLOW_NOT_PROVEN',stage,detail});
  if(cfg.market!=='MX'||cfg.environment!=='S2')return blocked('PROVIDER','The MX S2 cash contract is not proven in this environment.');
  const payment=new PaymentPage(page);payment.screenshot=capture;
  const parent=page.locator('mat-expansion-panel-header.sub-type-title').filter({hasText:/Paga en efectivo/i});
  const group=await payment.selectPaymentMode(/^Paga en efectivo/i,'epp-cash-group',{option:parent});
  await payment.validateControlledPaymentPanel(group,'EPP cash group');
  const child=await payment.selectPaymentMode(/^Paga en efectivo/i,'epp-cash-provider',{within:payment.selectedPaymentPanel});
  await payment.validateControlledPaymentPanel(child,'EPP cash provider');
  const contract=await details.wait();
  if(contract.unavailable||contract.http!==200||contract.mode!=='mx-mercadoCash'||!contract.submitEnabled||contract.totalChanged||contract.banks<1)return blocked('PROVIDER','The programme cash details did not prove a current enabled mx-mercadoCash contract. No submit was performed.');
  const panel=payment.selectedPaymentPanel;
  await expect(panel.getByRole('button',{name:/Ir a Mercado Pago/i})).toBeEnabled({timeout:30000});
  await test.info().attach('EPP cash prerequisite contract',{body:JSON.stringify({market:'MX',environment:'S2',provider:'mx-mercadoCash',banks:contract.banks,testBuyerConfigured:contract.testBuyer,externalCheckoutRequired:true,submitted:false}),contentType:'application/json'});
  await capture('epp-cash-ready-no-submit');
  if(!contract.testBuyer)return blocked('DATA','Cash is enabled but an approved Mercado Pago test buyer is not proven. No submit was performed.');
  return blocked('EXTERNAL_GATEWAY','mx-mercadoCash and a provider test buyer are configured; the enabled Ir a Mercado Pago action requires a verified test Checkout Pro/voucher and return contract. Provider buyer login/OTP access is not provisioned in EPP runtime data. No cash submit was performed.');
}
