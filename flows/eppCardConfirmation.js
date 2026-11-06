import {test} from '@playwright/test';
import {openEppStore} from './eppStorefront';
import {validateMxEppConfirmation} from './eppMxCardPayment';
import session from '../utils/eppSession.cjs';
import server from '../utils/eppServerProof.cjs';

// Read the same causal card order; this flow has no cart mutation or submit.
export async function validateExistingEppCardOrder(page,cfg,record,{allowObservedOrder=false}={}){
 const observed=allowObservedOrder&&(['CL','CO'].includes(cfg.market)||cfg.market==='PE'&&cfg.environment==='S2'&&cfg.program==='pe_membership_vip')&&record.status==='OBSERVED_ORDER';
 const clTransfer=cfg.market==='CL'&&record.kind==='transfer'&&record.providerConfirmationSubmitted===true&&(observed||record.status==='CONFIRMED');
 if(record.market!==cfg.market||record.environment!==cfg.environment||(!observed&&record.status!=='CONFIRMED')||(record.kind!=='card'&&!clTransfer))throw new Error('EPP confirmation must use its own confirmed causal card record or an explicitly reconciled CL observed order.');
 const proof=server.watchEppServerProof(page.context(),cfg,{expectedEmail:session.getPrimaryEppCredentials(cfg).email});
 try{
  await openEppStore(page,{...cfg,entryUrl:cfg.pdpUrl||cfg.rootUrl},{identityProof:proof});await proof.settle();
  if(!proof.accepted()){test.skip(true,'AUTH_OR_ENTITLEMENT_REQUIRED: causal confirmation requires accepted programme identity.');throw new Error('EPP confirmation identity not proven; no submit.');}
  const code=record.orderCode;
  if(!new RegExp(`^${cfg.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(code))throw new Error('Invalid causal order number.');
  const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2],origin=`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const pending=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.origin===origin&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/orders/${code}`;},{timeout:60000});
  const [response]=await Promise.all([pending,page.goto(new URL('orderConfirmation;orderCode='+encodeURIComponent(code),cfg.rootUrl).href,{waitUntil:'commit',timeout:60000})]);
  const order=response.ok()?await response.json():null;
  // OCC can return the exact internal code or its public form. The GET is
  // already bound to this causal internal ID; neither another public order
  // nor a different internal suffix is acceptable.
  if(!order||![code,code.replace(/_\d+$/,'')].includes(order.code))throw new Error('EPP confirmation API did not prove the causal public order number.');
  await validateMxEppConfirmation(page,cfg,code);
  await test.info().attach('EPP causal order confirmation',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,program:cfg.program,orderCode:code,sourceState:record.status,readOnly:true,submitCount:0,...(observed?{paymentAcceptanceProven:false}:{})}),contentType:'application/json'});
 }finally{proof.stop();}
}
