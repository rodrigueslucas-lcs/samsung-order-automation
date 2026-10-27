import {test,expect} from '@playwright/test';
import MxCheckoutPage from '../pages/MxCheckoutPage';
import {openEppStore,addConfiguredEppProduct} from './eppStorefront';
import session from '../utils/eppSession.cjs';
import server from '../utils/eppServerProof.cjs';
import runtime from '../utils/eppRuntimeData.cjs';
import assertions from '../utils/eppBusinessAssertions.cjs';
import {submitMxEppCard,validateMxEppConfirmation} from './eppMxCardPayment';
import attempts from '../utils/eppOrderAttempt.cjs';
import {watchMxEppCashDetails,inspectMxEppCash} from './eppMxCashPrerequisites';

// Discovery alone cannot pass a payment case. A proven market adapter may
// continue only under the explicit payment-submit opt-in below.
export async function probeEppPaymentPrerequisites(page,cfg,{kind='card',onProviderReady=null}={}) {
  const proof=server.watchEppServerProof(page.context(),cfg,{expectedEmail:session.getPrimaryEppCredentials(cfg).email});
  const cash=cfg.market==='MX'&&kind==='cash'?watchMxEppCashDetails(page,cfg):null;
  const blocked=(reason,detail,stage)=>({status:'BLOCKED',reason,detail,stage});
  const capture=async name=>{
    const path=test.info().outputPath(name+'.png');
    await page.screenshot({path,mask:[page.locator('input'),page.locator('iframe'),page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/)],fullPage:false});
    await test.info().attach(name,{path,contentType:'image/png'});
  };
  try {
    // A programme homepage can have no commerce CMS slots even when its
    // supplied PDP is functional. Prove access at that real eligible entry.
    await openEppStore(page,{...cfg,entryUrl:cfg.pdpUrl||cfg.rootUrl});await proof.settle();
    if(!proof.accepted())return blocked('AUTH_OR_ENTITLEMENT_REQUIRED','Independent EPP registered access was not accepted.','AUTH');
    if(!cfg.pdpUrl||!cfg.sku)return blocked('MISSING_OR_UNPROVEN_EPP_PRODUCT','An eligible programme PDP/SKU is required.','PRODUCT');
    const cart=await addConfiguredEppProduct(page,cfg,{resetMxCart:cfg.market==='MX'});
    if(cfg.market==='MX')await cart.validateControlledSingleSku(cfg.sku);
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
    if(onProviderReady)return await onProviderReady(page,cfg,capture);
    if(cash)return await inspectMxEppCash(page,cfg,capture,cash);
    return blocked('PAYMENT_FLOW_NOT_PROVEN','Provider is visible; its EPP backend, approved test-data and confirmation contract must be proven before enabling a submit adapter.','PROVIDER');
  } finally {cash?.stop();proof.stop();}
}

export async function runEppPaymentPrerequisiteCase(page,cfg,options){
  // This case includes a fresh cart, Contact, Delivery and provider discovery;
  // keep their bounded stage waits inside one explicit end-to-end budget.
  test.setTimeout(420000);
  if(process.env.EPP_RESUME_PENDING_ORDER==='1'&&(cfg.market!=='MX'||options?.kind!=='card'))throw new Error('Read-only EPP order recovery is restricted to the proven MX card adapter.');
  if(cfg.market==='MX'){
    const pending=['card','cash'].map(kind=>attempts.pendingEppOrderAttempt(cfg,kind)).find(Boolean);
    if(process.env.EPP_RESUME_PENDING_ORDER==='1'&&!pending){
      test.skip(true,'PAYMENT_FLOW_NOT_PROVEN: no pending EPP attempt exists for read-only recovery.');
      throw new Error('No pending EPP attempt; read-only recovery cannot reset a cart.');
    }
    if(pending){
      if(options?.kind!=='card'||pending.kind!=='card'||process.env.EPP_RESUME_PENDING_ORDER!=='1'||pending.status!=='OBSERVED_ORDER'||!pending.orderCode){
        test.skip(true,'PAYMENT_FLOW_NOT_PROVEN: AMBIGUOUS_EPP_ORDER_ATTEMPT requires reconciliation before any cart reset or new submit.');
        throw new Error('AMBIGUOUS_EPP_ORDER_ATTEMPT: no cart reset or new submit is allowed.');
      }
      const proof=server.watchEppServerProof(page.context(),cfg,{expectedEmail:session.getPrimaryEppCredentials(cfg).email});
      try{
        await openEppStore(page,{...cfg,entryUrl:cfg.rootUrl});await proof.settle();
        if(!proof.accepted())test.skip(true,'AUTH_OR_ENTITLEMENT_REQUIRED: existing order recovery needs verified EPP identity.');
        const target=new URL('orderConfirmation;orderCode='+encodeURIComponent(pending.orderCode),cfg.rootUrl);
        const site=cfg.rootUrl.pathname.split('/').filter(Boolean)[2];
        const api=`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
        const readback=page.waitForResponse(response=>{const u=new URL(response.url());return response.request().method()==='GET'&&u.origin===api&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/orders/${pending.orderCode}`;},{timeout:120000});
        const [response]=await Promise.all([readback,page.goto(target.href,{waitUntil:'commit',timeout:60000})]);
        if(!response.ok())throw new Error(`EPP causal order readback returned HTTP ${response.status()}; no submit was repeated.`);
        const order=await response.json();
        if(order.code!==pending.orderCode.replace(/_\d+$/,''))throw new Error('EPP readback did not identify the public number of the causal order.');
        await validateMxEppConfirmation(page,cfg,pending.orderCode);
        attempts.confirmPendingEppOrder(cfg,'card',pending.orderCode);
        await test.info().attach('EPP causal order recovery',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,orderCode:pending.orderCode,readOnlyRecovery:true,confirmationValidated:true}),contentType:'application/json'});
        return;
      }finally{proof.stop();}
    }
  }
  if(cfg.market==='MX'&&cfg.environment==='S2'&&options?.kind==='card'&&process.env.ALLOW_PAYMENT_SUBMIT!=='1'){
    test.skip(true,'PAYMENT_SUBMIT_NOT_AUTHORIZED: the proven MX S2 card adapter requires ALLOW_PAYMENT_SUBMIT=1.');
    throw new Error('PAYMENT_SUBMIT_NOT_AUTHORIZED: no cart or payment mutation is allowed.');
  }
  const submit=cfg.market==='MX'&&cfg.environment==='S2'&&options?.kind==='card'&&process.env.ALLOW_PAYMENT_SUBMIT==='1';
  const observed=await probeEppPaymentPrerequisites(page,cfg,{...options,onProviderReady:submit?submitMxEppCard:null});
  if(observed.status==='PASS'&&observed.orderCode)return;
  test.info().annotations.push({type:'epp-prerequisite',description:`${observed.reason}: ${observed.stage}`});
  test.skip(observed.status==='BLOCKED',`${observed.reason}: ${observed.detail}`);
  // A discovery result can never become an order/confirmation PASS.
  throw new Error('EPP prerequisite inspection did not supply a causal confirmed order.');
}
