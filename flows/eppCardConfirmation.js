import {test} from '@playwright/test';
import {openEppStore} from './eppStorefront';
import {validateMxEppConfirmation} from './eppMxCardPayment';
import session from '../utils/eppSession.cjs';
import server from '../utils/eppServerProof.cjs';

// Read the same causal card order; this flow has no cart mutation or submit.
export async function validateExistingEppCardOrder(page,cfg,record){
 if(record.market!==cfg.market||record.environment!==cfg.environment||record.status!=='CONFIRMED'||record.kind!=='card')throw new Error('EPP confirmation must use its own confirmed causal card record.');
 const proof=server.watchEppServerProof(page.context(),cfg,{expectedEmail:session.getPrimaryEppCredentials(cfg).email});
 try{
  await openEppStore(page,{...cfg,entryUrl:cfg.rootUrl});await proof.settle();
  if(!proof.accepted()){test.skip(true,'AUTH_OR_ENTITLEMENT_REQUIRED: causal confirmation requires accepted programme identity.');throw new Error('EPP confirmation identity not proven; no submit.');}
  const code=record.orderCode;
  if(!new RegExp(`^${cfg.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(code))throw new Error('Invalid causal order number.');
  const site=cfg.apiSite||cfg.rootUrl.pathname.split('/').filter(Boolean)[2],origin=`https://${cfg.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const pending=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.origin===origin&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/orders/${code}`;},{timeout:60000});
  const [response]=await Promise.all([pending,page.goto(new URL('orderConfirmation;orderCode='+encodeURIComponent(code),cfg.rootUrl).href,{waitUntil:'commit',timeout:60000})]);
  if(!response.ok()||(await response.json()).code!==code.replace(/_\d+$/,''))throw new Error('EPP confirmation API did not prove the causal public order number.');
  await validateMxEppConfirmation(page,cfg,code);
  await test.info().attach('EPP causal order confirmation',{body:JSON.stringify({market:cfg.market,environment:cfg.environment,program:cfg.program,orderCode:code,readOnly:true,submitCount:0}),contentType:'application/json'});
 }finally{proof.stop();}
}
