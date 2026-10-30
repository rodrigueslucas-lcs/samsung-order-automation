import {expect,test} from '@playwright/test';
import MarketPaymentPage from '../pages/MarketPaymentPage';
import {completeClFlowSandbox} from './cl/paymentFlows';
import {validateMxEppConfirmation} from './eppMxCardPayment';
import assertions from '../utils/eppBusinessAssertions.cjs';
import guards from '../utils/destructiveGuards';
import attempts from '../utils/eppOrderAttempt.cjs';

// Select the rendered Khipu method, not the first of three identically named
// bank accordions. Reuse CL's existing native submit and genuine Flow simulator.
export async function submitClEppBank(page,cfg,capture){
 if(cfg.market!=='CL'||cfg.environment!=='S2'||cfg.rootUrl.origin!=='https://stg2.shop.samsung.com')throw new Error('CL EPP bank adapter requires S2 staging.');
 assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
 guards.requirePaymentSubmitOptIn();
 const panel=page.locator('mat-expansion-panel:has(> mat-expansion-panel-header img[src*="khipu.png"])');
 // The outer Payment accordion also contains the logo. Its header is Pago,
 // hence only the leaf provider panel satisfies the exact heading above.
 await expect(panel).toHaveCount(1);
 const header=panel.locator('mat-expansion-panel-header');
 if(await header.getAttribute('aria-expanded')!=='true')await header.click();
 await expect(header).toHaveAttribute('aria-expanded','true');
 const button=panel.getByRole('button',{name:/^[¡!]?Pagar ahora!?.*$/i}).filter({visible:true});
 await expect(button).toHaveCount(1);await expect(button).toBeEnabled({timeout:60000});
 const payment=new MarketPaymentPage(page,{market:'CL'});payment.screenshot=capture;payment.placeOrderButton=button;
 const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2];
 const attempt=attempts.beginEppOrderAttempt(cfg,'transfer');
 let result;
 try{result=await payment.placeOrderAndCapture({submitResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/carts/[^/]+/paymentmodes/cl-[^/]+/submitOrder$`),orderResponsePathPattern:new RegExp(`^/tokocommercewebservices/v2/${site}/users/[^/]+/orders/CL\\d{6}-\\d{8}(?:_\\d+)?$`)});}
 catch{throw new Error('CL_EPP_BANK_SINGLE_SUBMIT_UNCONFIRMED: marker preserved; reconcile before another submit.');}
 attempt.observe(result.orderCode);
 await page.waitForURL(url=>url.hostname==='sandbox.flow.cl'||url.origin===cfg.rootUrl.origin&&/orderConfirmation/.test(url.pathname),{timeout:60000});
 if(new URL(page.url()).hostname==='sandbox.flow.cl')await completeClFlowSandbox(page,{orderCode:result.orderCode,storefrontOrigin:cfg.rootUrl.origin});
 await validateMxEppConfirmation(page,cfg,result.orderCode);
 attempt.confirm(result.orderCode);await capture('epp-cl-bank-causal-confirmation');
 await test.info().attach('EPP CL bank causal order',{body:JSON.stringify({market:'CL',environment:'S2',program:cfg.program,orderCode:result.orderCode,provider:'Khipu',confirmationValidated:true,submitCount:1}),contentType:'application/json'});
 return{status:'PASS',orderCode:result.orderCode};
}
