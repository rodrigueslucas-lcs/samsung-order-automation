import {expect,test} from '@playwright/test';
import PaymentPage from '../pages/PaymentPage';
import MarketPaymentPage from '../pages/MarketPaymentPage';
import clTestCard from '../utils/clTestCard.cjs';
import coTestCard from '../utils/coTestCard';
import assertions from '../utils/eppBusinessAssertions.cjs';
import runtime from '../utils/eppRuntimeData.cjs';
import guards from '../utils/destructiveGuards';
import attemptModule from '../utils/eppOrderAttempt.cjs';

function assertFreshEppOrder(baseline,orderCode,reconciledOrderCode=null){
 if(!baseline)return;
 const publicCode=code=>String(code).replace(/_\d+$/,'');
 const existing=[...baseline].some(code=>String(code)===orderCode||
  publicCode(code)===publicCode(orderCode)&&reconciledOrderCode!==orderCode);
 // A distinct internal ID is accepted only after the programme-bound GET
 // readback proves creation time, exact SKU/quantity and absence in baseline.
 if(existing)throw new Error('EPP_EXISTING_ORDER_RETURNED: submit identified a pre-existing order; no new-order PASS or retry.');
}

export async function validateMxEppConfirmation(page,cfg,orderCode){
 const matchesRoute=url=>{
  const code=new URL(url).pathname.match(/;orderCode=([^;/?]+)/)?.[1];
  if(!code)return false;
  const decoded=decodeURIComponent(code);
  if(decoded===orderCode)return true;
  return cfg.market==='MX'&&cfg.environment==='S2'&&cfg.program==='pymesmx'&&decoded.replace(/_\d+$/,'')===orderCode.replace(/_\d+$/,'')&&(!decoded.includes('_')||!orderCode.includes('_'));
 };
 // The submit response can arrive before the confirmation route finishes
 // binding its order code. Wait for this causal identity, not just the shell.
 if(cfg.market==='MX')await expect(page).toHaveURL(url=>matchesRoute(url.href),{timeout:60000});
 assertions.assertStoreRoute(page.url(),cfg,/^orderConfirmation/);
 if(!matchesRoute(page.url()))throw new Error('EPP confirmation URL does not identify the causal order.');
 const publicCode=orderCode.replace(/_\d+$/,'');
 const publicNumber=cfg.market==='MX'?page.getByText(new RegExp('\\b'+publicCode+'\\b')):page.getByText(publicCode,{exact:true});
 await expect(publicNumber.first()).toBeVisible({timeout:120000});
 await expect(page.getByText(/recibimos tu (?:orden|pedido).*exitos[ao]|gracias por tu compra|pedido confirmado|orden confirmada|pedido.*validaci[oó]n|order confirmed/i).first()).toBeVisible({timeout:30000});
}

// Reuses the established MX Mercado Pago secure-fields implementation. Only
// the EPP accordion label and programme-bound capture endpoints differ.
export async function submitMxEppCard(page,cfg,capture,reconciliation){
 if(cfg.market!=='MX')throw new Error('MX EPP adapter cannot target another market.');
 return submitEppMercadoCard(page,cfg,capture,reconciliation);
}
export async function submitPeEppCard(page,cfg,capture,reconciliation,confirmObserved=null){
 if(cfg.market!=='PE')throw new Error('PE EPP adapter cannot target another market.');
 return submitEppMercadoCard(page,cfg,capture,reconciliation,confirmObserved);
}
export async function submitClEppCard(page,cfg,capture,reconciliation){
 if(cfg.market!=='CL')throw new Error('CL EPP adapter cannot target another market.');
 return submitEppMercadoCard(page,cfg,capture,reconciliation);
}
export async function submitCoEppCard(page,cfg,capture,reconciliation,confirmObserved=null){
 if(cfg.market!=='CO'||cfg.environment!=='S2'||cfg.program!=='co_epp_agre')throw new Error('CO EPP card adapter requires its proven S2 programme.');
 return submitEppMercadoCard(page,cfg,capture,reconciliation,confirmObserved);
}
async function submitEppMercadoCard(page,cfg,capture,reconciliation=null,confirmObserved=null){
 const origins={S1:'https://stg.shop.samsung.com',S2:'https://stg2.shop.samsung.com'};
 if(!['MX','PE','CL','CO'].includes(cfg.market)||!origins[cfg.environment]||cfg.rootUrl.origin!==origins[cfg.environment]||(['PE','CL','CO'].includes(cfg.market)&&cfg.environment!=='S2'))return{status:'BLOCKED',reason:'PAYMENT_FLOW_NOT_PROVEN',stage:'PROVIDER',detail:'This adapter requires an approved staging market/environment and a runtime-verified Mercado Pago contract.'};
 assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
 guards.requirePaymentSubmitOptIn();
 const card=cfg.market==='CL'?clTestCard.getClTestCard():cfg.market==='CO'?coTestCard.getCoTestCard({...process.env,CO_QST_ENVIRONMENT:cfg.environment}):runtime.getEppRuntimeData(cfg)?.payment?.card;
 if(!card||!['number','holderName','expiry','cvv','document'].every(k=>typeof card[k]==='string'&&card[k]))return{status:'BLOCKED',reason:'PAYMENT_FLOW_NOT_PROVEN',stage:'DATA',detail:'Approved same-market/provider card fixture is unavailable in ignored EPP runtime data.'};
 const payment=['CL','CO'].includes(cfg.market)?new MarketPaymentPage(page,{market:cfg.market}):new PaymentPage(page);payment.screenshot=capture;
 if(cfg.market==='MX')payment.creditCardOption=cfg.environment==='S2'?page.getByRole('button',{name:/^Tarjeta de D[eé]bito/i}).filter({visible:true}).first():page.getByRole('button',{name:/^Tarjeta de (?:Cr[eé]dito|D[eé]bito)/i}).filter({visible:true});
 await payment.selectCreditCard();
 for(const name of ['cardNumber','expirationDate','securityCode']){
  const host=await page.frameLocator(`iframe[name="${name}"]`).locator('#'+name).evaluate(field=>field.ownerDocument.location.hostname);
  if(host!=='secure-fields.mercadopago.com')throw new Error('Unproven EPP card provider contract; payment was not submitted.');
 }
 const saveCard=page.getByRole('checkbox',{name:/guardar.*tarjeta|save.*card/i}).filter({visible:true});
 for(let i=0;i<await saveCard.count();i++){
  const option=saveCard.nth(i);
  if(await option.isChecked())await option.uncheck();
  if(await option.isChecked())throw new Error('EPP test card persistence could not be disabled; payment was not submitted.');
 }
 try{
  await payment.fillCardData(card);
  await payment.validateCreditCardReady(card);
 }catch{throw new Error('EPP card entry/readiness failed before submit; sensitive provider details suppressed.');}
 const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2];
 const baseline=reconciliation?await reconciliation.beforeSubmit():null;
 const attempt=attemptModule.beginEppOrderAttempt(cfg,'card');
  let result,reconciledOrderCode=null;
 try{result=await payment.placeOrderAndCapture({orderCodePattern:new RegExp(`\\b${cfg.market}\\d{6}-\\d{8}(?:_\\d+)?\\b`,'i'),
  submitResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/carts/[^/]+/paymentmodes/[^/]+/submitOrder$`),
  orderResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/orders/${cfg.market}\\d{6}-\\d{8}(?:_\\d+)?$`)});
 }catch(error){
  const businessCode=String(error.message).match(/business code (\d{3})/)?.[1];
  // Preserve a useful submit outcome without leaking raw request/provider data.
  const outcome=String(error.message).match(/completed with ([A-Z_]+)/)?.[1]||'UNCONFIRMED';
  let network=[];
  try{
   const rows=JSON.parse(String(error.message).split('Network evidence: ')[1]);
   network=rows.map(row=>{const path=new URL(row.endpoint).pathname;return{method:row.method,status:row.status,path:path.startsWith('/tokocommercewebservices/v2/')?path.replace(/\/users\/[^/]+/,'/users/[identity]').replace(/\/carts\/[^/]+/,'/carts/[cart]'):'[provider endpoint]'};});
  }catch{}
  await test.info().attach('EPP single submit diagnostic',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,program:cfg.program,outcome,businessCode,network,submitCount:1}),contentType:'application/json'});
  // CL/PE's frontend acceptance is causal order creation + visible confirmation,
  // not settlement. Preserve the 601 evidence; only a new programme/SKU-bound
  // order AND the success UI below can satisfy that frontend contract.
  const frontendOrder=cfg.environment==='S2'&&(cfg.market==='CL'&&cfg.program==='alianzas'||cfg.market==='PE'&&cfg.program==='pe_membership_vip'&&businessCode==='601');
  if(reconciliation&&(!businessCode||frontendOrder)){
   const reconciled=await reconciliation.afterSubmit(baseline);
   if(reconciled){
     assertFreshEppOrder(baseline,reconciled.orderCode,reconciled.orderCode);
     reconciledOrderCode=reconciled.orderCode;
    await page.goto(new URL('orderConfirmation;orderCode='+encodeURIComponent(reconciled.orderCode),cfg.rootUrl).href,{waitUntil:'commit',timeout:60000});
    result=reconciled;
   }
  }
  if(!result){
  throw new Error(`EPP_SINGLE_SUBMIT_UNCONFIRMED${businessCode?' businessCode='+businessCode:''}; attempt marker preserved, no retry. Raw provider details suppressed.`);
  }
 }
  assertFreshEppOrder(baseline,result.orderCode,reconciledOrderCode);
 attempt.observe(result.orderCode);
 await expect(page).toHaveURL(/orderConfirmation|order-confirmation|confirmacion/i,{timeout:60000});
 try{await validateMxEppConfirmation(page,cfg,result.orderCode);}
 catch(error){
  const observedAliasScope=cfg.environment==='S2'&&(cfg.market==='CO'&&cfg.program==='co_epp_agre'||cfg.market==='PE'&&cfg.program==='pe_membership_vip');
  if(!observedAliasScope||error.message!=='EPP confirmation URL does not identify the causal order.')throw error;
  // A new CO/PE submit can land on its internal confirmation alias while OCC
  // reports the public code. Reuse the scoped GET + UI reconciliation; never
  // weaken identity comparison, replay payment or accept another order.
  const route=new URL(page.url()).pathname.match(/;orderCode=([^;/?]+)/)?.[1];
  if(!route||route.replace(/_\d+$/,'')!==result.orderCode.replace(/_\d+$/,'')||route.includes('_')&&result.orderCode.includes('_'))throw error;
  await test.info().attach(cfg.market+' confirmation route reconciliation',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,orderCode:result.orderCode,routeOrderCode:route&&new RegExp('^'+cfg.market+'\\d{6}-\\d{8}(?:_\\d+)?$').test(route)?route:null,submitCount:1}),contentType:'application/json'});
  if(typeof confirmObserved!=='function')throw error;
  await confirmObserved(page,cfg,{market:cfg.market,environment:cfg.environment,kind:'card',status:'OBSERVED_ORDER',orderCode:result.orderCode},{allowObservedOrder:true});
 }
 attempt.confirm(result.orderCode);
 await capture('epp-causal-order-confirmation');
 await test.info().attach('EPP causal order',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,orderCode:result.orderCode,confirmationValidated:true}),contentType:'application/json'});
 return{status:'PASS',reason:'CONFIRMED_CAUSAL_ORDER',stage:'CONFIRMATION',orderCode:result.orderCode};
}
