import CheckoutPage from '../pages/CheckoutPage';
import assertions from '../utils/eppBusinessAssertions.cjs';
import runtime from '../utils/eppRuntimeData.cjs';
import {expect} from '@playwright/test';
import causalReadback from '../utils/eppCausalOrderReadback.cjs';

export async function acceptPeEppTerms(page){
  for(const name of [/autorizo el tratamiento/i,/declaro que he le[ií]do/i]){
    const checkbox=page.getByRole('checkbox',{name});
    if(!(await checkbox.isChecked()))await checkbox.check();
    await expect(checkbox).toBeChecked();
  }
}

export async function normalizeEppPaymentCart(page,cfg,cart,{observedResponse=null}={}){
  assertions.assertStoreRoute(page.url(),cfg,/^cart\/?$/);
  const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2];
  const origin=`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const endpoint=`${origin}/tokocommercewebservices/v2/${site}/users/current/carts/current`;
  let authorization;
  const controlledQuantity=state=>{
    if(!Array.isArray(state.entries)||state.entries.length!==1||state.entries[0].product?.code!==cfg.sku||!Number.isInteger(state.entries[0].quantity)||state.entries[0].quantity<1||state.entries[0].quantity>20)throw new Error('PE EPP payment requires one known product row, quantity 1–20 before normalization.');
    return state.entries[0].quantity;
  };
  const read=async()=>{
    if(observedResponse){
      const u=new URL(observedResponse.url());
      if(u.origin!==origin||u.pathname!==new URL(endpoint).pathname||observedResponse.request().method()!=='GET')throw new Error('EPP cart read evidence belongs to another endpoint.');
      authorization=await observedResponse.request().headerValue('authorization');
      return persisted();
    }
    const pending=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.origin===origin&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/carts/current`;},{timeout:60000});
    await page.goto(cfg.cartUrl.href,{waitUntil:'domcontentloaded',timeout:60000});
    const response=await pending;
    if(!response.ok())throw new Error('PE EPP controlled cart read failed.');
    authorization=await response.request().headerValue('authorization');
    // A navigation can evict Chromium's earlier response body. Use that
    // observed request only for scoped authorization, then read independently.
    return persisted();
  };
  const persisted=async()=>{
    const response=await page.context().request.get(endpoint,{headers:{origin:cfg.rootUrl.origin,referer:cfg.cartUrl.href,...(authorization?{authorization}:{})},timeout:15000,maxRedirects:0}).catch(()=>{throw new Error('PE EPP cart readback failed; request details suppressed.');});
    if(!response.ok())throw new Error('PE EPP quantity readback failed; no click replay.');
    return controlledQuantity(await response.json());
  };
  const initial=await read();
  const quantity=page.getByRole('textbox',{name:'Quantity'}).filter({visible:true});
  await expect(quantity).toHaveCount(1);
  await expect(quantity).toHaveValue(String(initial));
  const decrease=page.getByRole('button',{name:'-',exact:true}).filter({visible:true});
  for(let n=initial;n>1;n--){
    await decrease.click();
    await cart.waitForQuantityValue(quantity,String(n-1));
    // UI quantity is optimistic. Prove the completed write before another
    // click/navigation; poll only GET and never replay the mutation.
    await expect.poll(persisted,{timeout:20000,intervals:[250,500,1000]}).toBe(n-1);
  }
  if(await persisted()!==1)throw new Error('PE EPP quantity 1 did not persist; no checkout or payment allowed.');
  await expect(quantity).toHaveValue('1');
  return causalReadback.createEppCausalOrderReadback(cfg,{sku:cfg.sku,read:async suffix=>{
    const response=await page.context().request.get(`${origin}/tokocommercewebservices/v2/${site}${suffix}`,{headers:{origin:cfg.rootUrl.origin,referer:cfg.cartUrl.href,...(authorization?{authorization}:{})},timeout:15000,maxRedirects:0}).catch(()=>{throw new Error('EPP causal order readback failed; request details suppressed.');});
    if(!response.ok())throw new Error('EPP causal order readback was not accepted; no retry.');
    return response.json();
  }});
}

// Reuse PE's registered checkout without importing its Base Store session,
// navigation or cart setup. All transitions remain inside the EPP programme.
export async function completePeEppCheckout(page,cfg,capture=async()=>{}) {
  if(cfg.market!=='PE')throw new Error('PE EPP checkout cannot target another market.');
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  const contact=runtime.getEppContact(cfg),address=runtime.getEppRuntimeData(cfg)?.delivery;
  if(!contact||!address)return{status:'BLOCKED',reason:'MISSING_EPP_CONTACT_DATA',stage:'CONTACT',detail:'Approved PE programme contact and delivery data are required.'};
  const checkout=new CheckoutPage(page,{storefront:cfg});checkout.screenshot=capture;
  await page.waitForURL(/CHECKOUT_STEP_(CONTACT_INFO|DELIVERY)/,{timeout:60000});
  if(new URL(page.url()).searchParams.get('step')==='CHECKOUT_STEP_CONTACT_INFO')await checkout.fillCustomerData(contact);
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  await checkout.selectNewAuthenticatedAddress();
  await checkout.fillAddress(address);
  const save=page.getByRole('checkbox',{name:/Guardar datos de env[ií]o en Mi cuenta/i});
  if(await save.isVisible()&&await save.isChecked())await save.uncheck();
  await checkout.selectShippingMethod();
  await acceptPeEppTerms(page);
  await capture('epp-pe-terms-accepted');
  await checkout.continueToPayment();
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  return null;
}
