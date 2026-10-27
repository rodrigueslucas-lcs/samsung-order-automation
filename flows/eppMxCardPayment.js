import {expect,test} from '@playwright/test';
import PaymentPage from '../pages/PaymentPage';
import assertions from '../utils/eppBusinessAssertions.cjs';
import runtime from '../utils/eppRuntimeData.cjs';
import guards from '../utils/destructiveGuards';
import attemptModule from '../utils/eppOrderAttempt.cjs';

export async function validateMxEppConfirmation(page,cfg,orderCode){
 assertions.assertStoreRoute(page.url(),cfg,/^orderConfirmation/);
 const target=new URL(page.url());
 const routeCode=target.pathname.match(/;orderCode=([^;/?]+)/)?.[1];
 if(!routeCode||decodeURIComponent(routeCode)!==orderCode)throw new Error('EPP confirmation URL does not identify the causal order.');
 const publicCode=orderCode.replace(/_\d+$/,'');
 await expect(page.getByText(publicCode,{exact:true}).first()).toBeVisible({timeout:120000});
 await expect(page.getByText(/recibimos tu orden.*exitosa|gracias por tu compra|pedido confirmado|orden confirmada|pedido.*validaci[oó]n|order confirmed/i).first()).toBeVisible({timeout:30000});
}

// Reuses the established MX Mercado Pago secure-fields implementation. Only
// the EPP accordion label and programme-bound capture endpoints differ.
export async function submitMxEppCard(page,cfg,capture){
 if(cfg.market!=='MX'||cfg.environment!=='S2')return{status:'BLOCKED',reason:'PAYMENT_FLOW_NOT_PROVEN',stage:'PROVIDER',detail:'This adapter has only been discovered in MX S2.'};
 assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
 guards.requirePaymentSubmitOptIn();
 const card=runtime.getEppRuntimeData(cfg)?.payment?.card;
 if(!card||!['number','holderName','expiry','cvv','document'].every(k=>typeof card[k]==='string'&&card[k]))return{status:'BLOCKED',reason:'PAYMENT_FLOW_NOT_PROVEN',stage:'DATA',detail:'Approved same-provider MX card fixture is unavailable in ignored EPP runtime data.'};
 const payment=new PaymentPage(page);payment.screenshot=capture;
 payment.creditCardOption=page.getByRole('button',{name:/^Tarjeta de D[eé]bito/i}).filter({visible:true}).first();
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
 const site=cfg.rootUrl.pathname.split('/').filter(Boolean)[2];
 const attempt=attemptModule.beginEppOrderAttempt(cfg,'card');
 let result;
 try{result=await payment.placeOrderAndCapture({orderCodePattern:/\bMX\d{6}-\d{8}(?:_\d+)?\b/i,
  submitResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/carts/[^/]+/paymentmodes/[^/]+/submitOrder$`),
  orderResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/orders/MX\\d{6}-\\d{8}(?:_\\d+)?$`)});
 }catch(error){
  const businessCode=String(error.message).match(/business code (\d{3})/)?.[1];
  throw new Error(`EPP_SINGLE_SUBMIT_UNCONFIRMED${businessCode?' businessCode='+businessCode:''}; attempt marker preserved, no retry. Raw provider details suppressed.`);
 }
 attempt.observe(result.orderCode);
 await expect(page).toHaveURL(/orderConfirmation|order-confirmation|confirmacion/i,{timeout:60000});
 await validateMxEppConfirmation(page,cfg,result.orderCode);
 attempt.confirm(result.orderCode);
 await capture('epp-causal-order-confirmation');
 await test.info().attach('EPP causal order',{body:JSON.stringify({market:'MX',environment:'S2',orderCode:result.orderCode,confirmationValidated:true}),contentType:'application/json'});
 return{status:'PASS',reason:'CONFIRMED_CAUSAL_ORDER',stage:'CONFIRMATION',orderCode:result.orderCode};
}
