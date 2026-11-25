const {expect}=require('@playwright/test');

function watchMxEppPaymentRead(page,config,{now=Date.now}={}){
  const root=new URL(config.rootUrl);
  const enabled=config.market==='MX'&&config.environment==='S2'&&config.program==='pymesmx'&&
    root.origin==='https://stg2.shop.samsung.com'&&root.pathname==='/mx/multistore/pymesmx/pymesmx/';
  let current=null,attempted=false,ignoredOwnReadStep=null;
  const atPayment=()=>{
    const url=new URL(page.url());
    return url.origin===root.origin&&url.pathname===root.pathname+'checkout/one'&&url.searchParams.get('step')==='CHECKOUT_STEP_PAYMENT';
  };
  const request=r=>{
    const url=new URL(r.url());
    if(enabled&&r.method()==='GET'&&url.origin==='https://s2-smb-api-cdn.ecom-stg.samsung.com'&&
      url.pathname==='/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes'){
      if(!atPayment()){ignoredOwnReadStep=new URL(page.url()).searchParams.get('step');return;}
      current={request:r,started:now(),pending:true,status:null,failed:false};
    }
  };
  const response=r=>{if(current?.request===r.request())current.status=r.status();};
  const finished=r=>{if(current?.request===r)current.pending=false;};
  const failed=r=>{if(current?.request===r){current.pending=false;current.failed=current.status===null&&now()-current.started>=55000;}};
  for(const [event,handler] of [['request',request],['response',response],['requestfinished',finished],['requestfailed',failed]])page.on(event,handler);
  return{
    snapshot:()=>({enabled,observed:Boolean(current),pending:current?.pending===true,status:current?.status??null,transportTimeout:current?.failed===true,elapsedMs:current?Math.max(0,now()-current.started):null,recoveryAttempted:attempted,ignoredOwnReadStep}),
    pending:()=>enabled&&atPayment()&&current?.pending===true,
    claimRecovery:()=>{
      if(!enabled||!atPayment()||attempted||!current?.failed||current.pending)return false;
      attempted=true;return true;
    },
    stop:()=>{for(const [event,handler] of [['request',request],['response',response],['requestfinished',finished],['requestfailed',failed]])page.off(event,handler);},
  };
}

async function recoverMxEppPaymentRead(page,offers,read,{settleTimeoutMs=15000,providerTimeoutMs=60000,renderSettleTimeoutMs=15000}={}){
  // Angular's payment-mode GET can fail at its own one-minute deadline just
  // after the provider UI wait. Never reload an in-flight request or replay
  // an HTTP rejection. The caller is still before its financial callback.
  if(read.pending())await expect.poll(()=>read.pending(),{timeout:settleTimeoutMs}).toBe(false).catch(()=>{});
  if(!read.claimRecovery())return false;
  console.log('[epp-payment] MX S2 payment-mode read timed out; one native Payment reload before any submit.');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  const rendered=await offers.first().waitFor({timeout:providerTimeoutMs}).then(()=>true,()=>false);
  if(rendered||!read.pending())return rendered;
  // The replacement GET starts after reload bootstrap. Its own deadline may
  // therefore outlive the UI wait; do not tear down a still-running read at
  // that boundary. This settles the same GET, never a second navigation.
  await expect.poll(()=>read.pending(),{timeout:settleTimeoutMs}).toBe(false).catch(()=>{});
  if(read.pending())return false;
  return offers.first().waitFor({timeout:renderSettleTimeoutMs}).then(()=>true,()=>false);
}

module.exports={watchMxEppPaymentRead,recoverMxEppPaymentRead};
