const {expect}=require('@playwright/test');
function isMxS2BaseCheckout(value){
 try{const u=new URL(value);return u.origin==='https://stg2.shop.samsung.com'&&u.pathname==='/mx/checkout/one'&&/^CHECKOUT_STEP_(DELIVERY|PAYMENT)$/.test(u.searchParams.get('step')||'');}catch{return false;}
}
async function continueToReadyMxBasePayment(page,transition,validate,{uiTimeoutMs=60000,settleTimeoutMs=15000}={}){
 if(!isMxS2BaseCheckout(page.url()))throw new Error('MX_PAYMENT_SCOPE_INVALID: S2 Base Store checkout required.');
 for(const value of [uiTimeoutMs,settleTimeoutMs])if(!Number.isFinite(value)||value<=0)throw new Error('MX payment readiness deadline must be finite and positive.');
 const reads=new Map();let latest;
 const started=r=>{
  const u=new URL(r.url());
  if(r.method()==='GET'&&u.origin==='https://s2-smb-api-cdn.ecom-stg.samsung.com'&&u.pathname==='/tokocommercewebservices/v2/mx/users/current/carts/current/paymentmodes'){
   latest={pending:true,status:null};reads.set(r,latest);
  }
 };
 const response=r=>{const read=reads.get(r.request());if(read)read.status=r.status();};
 const ended=r=>{const read=reads.get(r);if(read)read.pending=false;};
 const pending=()=>[...reads.values()].some(r=>r.pending);
 const hooks=[['request',started],['response',response],['requestfinished',ended],['requestfailed',ended]];
 for(const [event,handler] of hooks)page.on(event,handler);
 const region=page.getByRole('region',{name:/3\. M[eé]todos de Pago/i});
 const controls=region.getByRole('button',{name:/tarjeta|cr[eé]dito|d[eé]bito|efectivo|billeteras|paypal|mercado|transferencia/i}).filter({visible:true}).first();
 const ready=timeout=>controls.waitFor({state:'visible',timeout}).then(()=>true,()=>false);
 async function settle(){
  if(pending())await expect.poll(pending,{timeout:settleTimeoutMs}).toBe(false).catch(()=>{});
  if(pending())throw new Error('MX_PAYMENT_READ_PENDING: payment-method GET is still running; no reload or financial submission.');
  if([401,403].includes(latest?.status))throw new Error('MX_PAYMENT_AUTH_REJECTED: payment-method read was not authorized; no reload.');
 }
 try{
  try{await transition();}catch(error){if(new URL(page.url()).searchParams.get('step')!=='CHECKOUT_STEP_PAYMENT')throw error;}
  if(!isMxS2BaseCheckout(page.url())||new URL(page.url()).searchParams.get('step')!=='CHECKOUT_STEP_PAYMENT')throw new Error('MX_PAYMENT_ROUTE_NOT_REACHED');
  let rendered=await ready(uiTimeoutMs);
  if(!rendered){
   await settle();
   rendered=await ready(settleTimeoutMs);
  }
  if(!rendered){
   if(!latest)throw new Error('MX_PAYMENT_READ_NOT_OBSERVED: no proven completed payment-method read; no reload.');
   console.log('[mx-checkout] Completed payment-method read left no provider controls; one native Payment reload before any financial submit.');
   await page.reload({waitUntil:'domcontentloaded',timeout:60000});
   rendered=await ready(uiTimeoutMs);
   if(!rendered){await settle();rendered=await ready(settleTimeoutMs);}
  }
  if(!rendered)throw new Error('MX_PAYMENT_UI_NOT_READY: provider controls did not render after one read-only recovery.');
  await validate();
 }finally{for(const [event,handler] of hooks)page.off(event,handler);}
}
module.exports={isMxS2BaseCheckout,continueToReadyMxBasePayment};
