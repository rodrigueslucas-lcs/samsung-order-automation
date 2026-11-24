// GET-only reconciliation after a single submit. A previously existing order
// cannot become evidence for a new payment attempt.
function createEppCausalOrderReadback(config,{read,sku,quantity=1}){
 const site=config.rootUrl.pathname.split('/').filter(Boolean)[2];
 const reader=require('./causalOrderReadback.cjs').createCausalOrderReadback({market:config.market,site},{read,sku,quantity});
 // Rejection reconciliation requires the entire authoritative history, not
 // an empty first page. Other market adapters retain their existing contract.
 if(config.market==='MX'&&config.environment==='S2'&&config.program==='pymesmx')reader.proveNoOrderSince=async attemptAt=>{
  const threshold=Date.parse(attemptAt)-60000;
  if(!Number.isFinite(threshold))throw new Error('Invalid reconciliation timestamp.');
  const orders=[];let total=null,pages=null,complete=false,headCodes;
  for(let index=0;index<100;index++){
   const body=await read('/users/current/orders?fields=FULL&pageSize=20&currentPage='+index+'&sort=byDate');
   const rows=body.orders||body.searchPageData?.results||body.currentOrders,p=body.pagination||body.searchPageData?.pagination;
   if(!Array.isArray(rows)||!p||!Number.isInteger(p.totalNumberOfResults)||p.totalNumberOfResults<0||!Number.isInteger(p.numberOfPages)||p.numberOfPages<0||p.currentPage!==index||total!==null&&total!==p.totalNumberOfResults||pages!==null&&pages!==p.numberOfPages)throw new Error('Complete stable order history not proven.');
   total=p.totalNumberOfResults;pages=p.numberOfPages;if(index===0)headCodes=rows.map(o=>o.code);orders.push(...rows);
   if(index+1>=pages){complete=true;break;}
  }
  if(!complete||orders.length!==total||new Set(orders.map(o=>o.code)).size!==orders.length)throw new Error('Complete unique order history not proven.');
  for(const row of orders){
   if(!new RegExp('^'+config.market+'\\d{6}-\\d{8}(?:_\\d+)?$').test(row.code))throw new Error('Order identity not proven.');
   const detail=await read('/users/current/orders/'+encodeURIComponent(row.code)+'?fields=FULL');
   const created=Date.parse(detail.placed||detail.created||'');
   if(detail.code!==row.code||!Number.isFinite(created))throw new Error('Order creation time not proven.');
   // Any new order, including another programme/SKU, prevents automatic release.
   if(created>=threshold)return null;
  }
  // Detail reads can take time. An order arriving during that scan must keep
  // the marker guarded, even when the initial page was complete and empty.
  const again=await read('/users/current/orders?fields=FULL&pageSize=20&currentPage=0&sort=byDate');
  const rows=again.orders||again.searchPageData?.results||again.currentOrders,p=again.pagination||again.searchPageData?.pagination;
  if(!Array.isArray(rows)||p?.currentPage!==0||p.totalNumberOfResults!==total||p.numberOfPages!==pages||JSON.stringify(rows.map(o=>o.code))!==JSON.stringify(headCodes))throw new Error('Order history changed during reconciliation; no release.');
  return{market:config.market,environment:config.environment,program:config.program,attemptAt,readOnly:true,historyComplete:true,candidates:[]};
 };
 return reader;
}
async function createEppReadbackFromCartResponse(page,config,response){
 const site=config.apiSite||config.rootUrl.pathname.split('/').filter(Boolean)[2];
 const origin=`https://${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
 const url=new URL(response.url());
 if(response.request().method()!=='GET'||!response.ok()||url.origin!==origin||url.pathname!==`/tokocommercewebservices/v2/${site}/users/current/carts/current`)throw new Error('EPP order readback requires its own observed programme cart.');
 const authorization=await response.request().headerValue('authorization');
 return createEppCausalOrderReadback(config,{sku:config.sku,read:async suffix=>{
  const result=await page.context().request.get(`${origin}/tokocommercewebservices/v2/${site}${suffix}`,{headers:{origin:config.rootUrl.origin,referer:config.rootUrl.href,...(authorization?{authorization}:{})},maxRedirects:0,timeout:30000}).catch(()=>{throw new Error('EPP order readback unavailable; provider details suppressed.');});
  if(!result.ok())throw new Error('EPP order readback not accepted.');
  return result.json();
 }});
}
module.exports={createEppCausalOrderReadback,createEppReadbackFromCartResponse};
