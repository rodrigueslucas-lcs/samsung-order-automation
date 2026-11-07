import {test,expect} from '@playwright/test';
import MxCheckoutPage from '../pages/MxCheckoutPage';
import {openEppStore,addConfiguredEppProduct} from './eppStorefront';
import session from '../utils/eppSession.cjs';
import server from '../utils/eppServerProof.cjs';
import runtime from '../utils/eppRuntimeData.cjs';
import assertions from '../utils/eppBusinessAssertions.cjs';
import {submitMxEppCard,submitPeEppCard,submitClEppCard,submitCoEppCard,validateMxEppConfirmation} from './eppMxCardPayment';
import attempts from '../utils/eppOrderAttempt.cjs';
import {watchMxEppCashDetails,inspectMxEppCash} from './eppMxCashPrerequisites';
import {completeClEppCheckout} from './eppClCheckout';
import {completePeEppCheckout,normalizeEppPaymentCart} from './eppPeCheckout';
import clPaymentCart from './cl/paymentCart.cjs';
import {validateExistingEppCardOrder} from './eppCardConfirmation';
import {submitClEppBank} from './eppClBankPayment';
import coCheckout from './co/eppCheckout.cjs';
import causalReadback from '../utils/eppCausalOrderReadback.cjs';

// Worker-local, current-campaign prerequisites only; never historical order evidence.
const campaignPrerequisites=new Map();
const campaignKey=(cfg,runId)=>[cfg.market,cfg.environment,cfg.program,runId].join(':');

function enforceEppPayment(condition, reason, cfg) {
  if (!condition) return;
  // An unresolved earlier initiation prevents this case from executing at
  // all. Report that prerequisite consistently, without rewriting the failed
  // case which actually submitted it or releasing its durable marker.
  if(reason.startsWith('AMBIGUOUS_EPP_ORDER_ATTEMPT:')){
    test.skip(true,reason);
    throw new Error(reason); // Fail closed if an embedded skip stub returns.
  }
  // A CL S2 QST precondition is a reported failure, not a silent skip.
  // Never retry ambiguous submissions or bypass identity/provider checks.
  if (cfg?.market === 'CL' && cfg.environment === 'S2') throw new Error(reason);
  test.skip(true, reason);
}

// Discovery alone cannot pass a payment case. A proven market adapter may
// continue only under the explicit payment-submit opt-in below.
export async function probeEppPaymentPrerequisites(page,cfg,{kind='card',onProviderReady=null}={}) {
  const proof=server.watchEppServerProof(page.context(),cfg,{expectedEmail:session.getPrimaryEppCredentials(cfg).email});
  const cash=cfg.market==='MX'&&kind==='cash'?watchMxEppCashDetails(page,cfg):null;
  let observedCartResponse;
  const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2],apiOrigin=`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const recordCart=response=>{const u=new URL(response.url());if(response.request().method()==='GET'&&u.origin===apiOrigin&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/carts/current`&&response.ok())observedCartResponse=response;};
  page.on('response',recordCart);
  const blocked=(reason,detail,stage)=>({status:'BLOCKED',reason,detail,stage});
  const capture=async name=>{
    const path=test.info().outputPath(name+'.png');
    await page.screenshot({path,mask:[page.locator('input'),page.locator('iframe'),page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/)],fullPage:false});
    await test.info().attach(name,{path,contentType:'image/png'});
  };
  try {
    let reconciliation=null;
    // A programme homepage can have no commerce CMS slots even when its
    // supplied PDP is functional. Prove access at that real eligible entry.
    await openEppStore(page,{...cfg,entryUrl:cfg.pdpUrl||cfg.rootUrl});await proof.settle();
    if(!proof.accepted())return blocked('AUTH_OR_ENTITLEMENT_REQUIRED','Independent EPP registered access was not accepted.','AUTH');
    if(!cfg.pdpUrl||!cfg.sku)return blocked('MISSING_OR_UNPROVEN_EPP_PRODUCT','An eligible programme PDP/SKU is required.','PRODUCT');
    const cart=await addConfiguredEppProduct(page,cfg,{resetMxCart:cfg.market==='MX'&&cfg.environment==='S2'});
    if(cfg.market==='MX'&&cfg.environment==='S1'){
      if(!observedCartResponse)throw new Error('MX EPP cart evidence not observed; no unproven checkout.');
      cart.observedCartResponse=observedCartResponse;
      reconciliation=await normalizeEppPaymentCart(page,cfg,cart,{observedResponse:observedCartResponse});
    }
    if(cfg.market==='MX')await cart.validateControlledSingleSku(cfg.sku);
    if(cfg.market==='PE')reconciliation=await normalizeEppPaymentCart(page,cfg,cart,{observedResponse:observedCartResponse});
    if(cfg.market==='CL'){
      if(!observedCartResponse)throw new Error('CL EPP cart request was not observed; no blind reload or payment.');
      const prepared=await clPaymentCart.prepareClPaymentCart(page,{...cfg,storefront:cfg},{observedResponse:observedCartResponse});
      await clPaymentCart.normalizeClPaymentQuantity(page,cart,{readBack:prepared?.readCart});
      reconciliation=await causalReadback.createEppReadbackFromCartResponse(page,cfg,observedCartResponse);
    }
    await cart.proceedToAuthenticatedCheckout();
    assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
    if(cfg.market==='MX') {
      const data=runtime.getEppRuntimeData(cfg),contact=runtime.getEppContact(cfg);
      if(!contact||!data?.delivery)return blocked('MISSING_EPP_CONTACT_DATA','Controlled contact/delivery fixture is unavailable.','CONTACT');
      const checkout=new MxCheckoutPage(page,{storefront:cfg});checkout.screenshot=capture;
      await checkout.fillRegisteredContact(contact);
      await checkout.waitForRegisteredAddressModes();
      const fresh=page.getByRole('radio',{name:/Nueva direcci[oó]n|New address/i}).filter({visible:true}).first();
      await expect(fresh).toBeVisible({timeout:30000});await fresh.check({force:true});await expect(fresh).toBeChecked();
      await checkout.fillDelivery(data.delivery,{registered:true});
      await checkout.selectDeliveryAndContinue();
    }else if(cfg.market==='CL'){
      const prerequisite=await completeClEppCheckout(page,cfg,capture);
      if(prerequisite){
        if(!proof.accepted())return blocked('AUTH_OR_ENTITLEMENT_REQUIRED','EPP identity/entitlement was not retained at CL Delivery.','AUTH');
        return prerequisite;
      }
    }else if(cfg.market==='CO'){
      const prerequisite=await coCheckout.completeCoEppCheckout(page,cfg,capture);
      if(prerequisite)return prerequisite;
    }else if(cfg.market==='PE'){
      const prerequisite=await completePeEppCheckout(page,cfg,capture);
      if(prerequisite)return prerequisite;
    }
    const step=new URL(page.url()).searchParams.get('step');
    if(cfg.market!=='MX'&&step==='CHECKOUT_STEP_CONTACT_INFO'&&!runtime.getEppContact(cfg))return blocked('MISSING_EPP_CONTACT_DATA','EPP checkout rendered Contact; approved contact/delivery mass for this market and environment is not configured.','CONTACT');
    if(step!=='CHECKOUT_STEP_PAYMENT')return blocked('PAYMENT_FLOW_NOT_PROVEN',`Registered EPP checkout reached ${step||'an unproven step'}; a compatible delivery flow is still required.`,'DELIVERY');
    assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
    const pattern=/tarjeta|cr[eé]dito|d[eé]bito|credit|debit|efectivo|banc|mercado|webpay|flow|cash|wallet|spei|oxxo/i;
    const offers=page.getByRole('button',{name:pattern}).filter({visible:true});
    const rendered=await offers.first().waitFor({timeout:60000}).then(()=>true,()=>false);
    await capture('epp-payment-provider-discovery');
    if(!rendered)return blocked('EPP_COMMERCE_NOT_RENDERED','Payment step opened, but no payment-provider controls rendered.','PAYMENT');
    const providers=await offers.evaluateAll(es=>es.map(e=>e.textContent.trim().replace(/\d{4,}/g,'[digits]').slice(0,100)));
    await test.info().attach('EPP observed providers',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,providers}),contentType:'application/json'});
    const desired=kind==='cash'?/efectivo|cash|oxxo/i:kind==='transfer'?/transfer|banc|spei/i:/tarjeta|cr[eé]dito|d[eé]bito|credit|debit|webpay/i;
    if(!providers.some(label=>desired.test(label)))return blocked('PROVIDER_NOT_AVAILABLE',`No ${kind} provider was offered for the controlled EPP checkout.`,'PAYMENT');
    if(!proof.accepted())return blocked('AUTH_OR_ENTITLEMENT_REQUIRED','EPP identity/entitlement changed before provider continuation.','PROVIDER');
    if(onProviderReady)return await onProviderReady(page,cfg,capture,reconciliation);
    if(cash)return await inspectMxEppCash(page,cfg,capture,cash);
    return blocked('PAYMENT_FLOW_NOT_PROVEN','Provider is visible; its EPP backend, approved test-data and confirmation contract must be proven before enabling a submit adapter.','PROVIDER');
  } finally {page.off('response',recordCart);cash?.stop();proof.stop();}
}

export async function runEppPaymentPrerequisiteCase(page,cfg,options){
  test.setTimeout(420000);
  const kinds=cfg.market==='CL'?['card','transfer']:['card','cash'];
  const pendingRecords=kinds.map(kind=>attempts.pendingEppOrderAttempt(cfg,kind)).filter(Boolean);
  const runId=process.env.EPP_RUN_ID;
  // Explicit read-only recovery is never a normal payment homologation.
  if(process.env.EPP_RESUME_PENDING_ORDER==='1'){
    const pending=pendingRecords.find(record=>record.kind===options?.kind);
    if(!pending||pending.status!=='OBSERVED_ORDER'||!pending.orderCode||pending.kind==='transfer'&&pending.providerConfirmationSubmitted!==true)throw new Error('AMBIGUOUS_EPP_ORDER_ATTEMPT: recovery requires its own reconciled causal order; no cart mutation or submit.');
    await validateExistingEppCardOrder(page,cfg,pending,{allowObservedOrder:true});
    attempts.confirmPendingEppOrder(cfg,pending.kind,pending.orderCode);
    test.info().annotations.push({type:'epp-execution-mode',description:'RECOVERY_ONLY'});
    return;
  }
  if(options?.confirmationOnly){
    const current=attempts.confirmedEppOrderForRun(cfg,runId);
    if(current){await validateExistingEppCardOrder(page,cfg,current);return;}
    const observed=pendingRecords.find(record=>record.runId===runId&&record.status==='OBSERVED_ORDER'&&record.orderCode);
    if(observed){
      if(observed.kind==='transfer'&&observed.providerConfirmationSubmitted!==true)throw new Error('AMBIGUOUS_EPP_ORDER_ATTEMPT: bank confirmation stage is incomplete.');
      await validateExistingEppCardOrder(page,cfg,observed,{allowObservedOrder:true});
      attempts.confirmPendingEppOrder(cfg,observed.kind,observed.orderCode);return;
    }
    const upstream=campaignPrerequisites.get(campaignKey(cfg,runId));
    if(upstream){
      const reason=upstream.reason+': this campaign payment was blocked before order creation; confirmation cannot execute.';
      enforceEppPayment(true,reason,cfg);throw new Error(reason);
    }
    const targets=String(process.env[`${cfg.market}_QST_TARGET_IDS`]||process.env.P1_TARGET_IDS||'').split(/[\s,;]+/).filter(Boolean);
    if(targets.length!==1)throw new Error('CURRENT_RUN_ORDER_REQUIRED: this campaign has no causal confirmed order; confirmation cannot substitute another payment after failed payment cases.');
    // A standalone confirmation target creates one order only when authorized.
  }
  // Identified old attempts are independently reconciled and archived before
  // a fresh checkout; unidentified submits are never cleared or blindly retried.
  if(pendingRecords.some(pending=>pending.status!=='OBSERVED_ORDER'||!pending.orderCode||pending.kind==='transfer'&&pending.providerConfirmationSubmitted!==true)){
    const reason='AMBIGUOUS_EPP_ORDER_ATTEMPT: reconcile the existing initiation before any cart reset or new submit.';
    campaignPrerequisites.set(campaignKey(cfg,runId),{reason:'AMBIGUOUS_EPP_ORDER_ATTEMPT'});
    enforceEppPayment(true,reason,cfg);
    throw new Error(reason); // Fail closed even if an embedded runner does not terminate on skip.
  }
  if(process.env.ALLOW_PAYMENT_SUBMIT!=='1'){
    enforceEppPayment(true,'PAYMENT_SUBMIT_NOT_AUTHORIZED: normal EPP payment requires a new causal order; historical confirmation is not a substitute.',cfg);
    throw new Error('PAYMENT_SUBMIT_NOT_AUTHORIZED: no cart mutation or financial action is allowed.');
  }
  if(!runId||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(runId))throw new Error('CURRENT_RUN_ORDER_REQUIRED: use the isolated local EPP market runner.');
  for(const pending of pendingRecords){
    await validateExistingEppCardOrder(page,cfg,pending,{allowObservedOrder:true});
    attempts.confirmPendingEppOrder(cfg,pending.kind,pending.orderCode);
  }
  const submit=['MX','PE','CL','CO'].includes(cfg.market)&&(cfg.market==='MX'||cfg.environment==='S2')&&options?.kind==='card';
  const bank=cfg.market==='CL'&&cfg.environment==='S2'&&options?.kind==='transfer';
  const observed=await probeEppPaymentPrerequisites(page,cfg,{...options,onProviderReady:bank?submitClEppBank:submit?(cfg.market==='CO'?((...args)=>submitCoEppCard(...args,validateExistingEppCardOrder)):cfg.market==='CL'?submitClEppCard:cfg.market==='PE'?submitPeEppCard:submitMxEppCard):null});
  if(observed.status==='PASS'&&observed.orderCode)return;
  if(observed.status==='BLOCKED')campaignPrerequisites.set(campaignKey(cfg,runId),{reason:observed.reason});
  test.info().annotations.push({type:'epp-prerequisite',description:`${observed.reason}: ${observed.stage}`});
  enforceEppPayment(observed.status==='BLOCKED',`${observed.reason}: ${observed.detail}`,cfg);
  throw new Error('EPP prerequisite inspection did not supply a new causal confirmed order.');
}
