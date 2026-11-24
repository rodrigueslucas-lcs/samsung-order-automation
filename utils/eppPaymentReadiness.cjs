const {expect}=require('@playwright/test');

function watchMxEppPaymentRead(page,config,{now=Date.now}={}){
  const root=new URL(config.rootUrl);
  const enabled=config.market==='MX'&&config.environment==='S2'&&config.program==='pymesmx'&&
    root.origin==='https://stg2.shop.samsung.com'&&root.pathname==='/mx/multistore/pymesmx/pymesmx/';
  let current=null,attempted=false;
  const atPayment=()=>{
    const url=new URL(page.url());
    return url.origin===root.origin&&url.pathname===root.pathname+'checkout/one'&&url.searchParams.get('step')==='CHECKOUT_STEP_PAYMENT';
  };
  const request=r=>{
    const url=new URL(r.url());
    if(enabled&&atPayment()&&r.method()==='GET'&&url.origin==='https://s2-smb-api-cdn.ecom-stg.samsung.com'&&
      url.pathname==='/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes'){
      current={request:r,started:now(),pending:true,status:null,failed:false};
    }
  };
  const response=r=>{if(current?.request===r.request())current.status=r.status();};
  const finished=r=>{if(current?.request===r)current.pending=false;};
  const failed=r=>{if(current?.request===r){current.pending=false;current.failed=current.status===null&&now()-current.started>=55000;}};
  for(const [event,handler] of [['request',request],['response',response],['requestfinished',finished],['requestfailed',failed]])page.on(event,handler);
  return{
    pending:()=>enabled&&atPayment()&&current?.pending===true,
    claimRecovery:()=>{
      if(!enabled||!atPayment()||attempted||!current?.failed||current.pending)return false;
      attempted=true;return true;
    },
    stop:()=>{for(const [event,handler] of [['request',request],['response',response],['requestfinished',finished],['requestfailed',failed]])page.off(event,handler);},
  };
}

async function recoverMxEppPaymentRead(page,offers,read,{settleTimeoutMs=15000}={}){
  // Angular's payment-mode GET can fail at its own one-minute deadline just
  // after the provider UI wait. Never reload an in-flight request or replay
  // an HTTP rejection. The caller is still before its financial callback.
  if(read.pending())await expect.poll(()=>read.pending(),{timeout:settleTimeoutMs}).toBe(false).catch(()=>{});
  if(!read.claimRecovery())return false;
  console.log('[epp-payment] MX S2 payment-mode read timed out; one native Payment reload before any submit.');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  return offers.first().waitFor({timeout:60000}).then(()=>true,()=>false);
}

module.exports={watchMxEppPaymentRead,recoverMxEppPaymentRead};
