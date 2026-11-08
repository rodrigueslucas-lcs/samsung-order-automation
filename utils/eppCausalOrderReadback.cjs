// GET-only reconciliation after a single submit. A previously existing order
// cannot become evidence for a new payment attempt.
function createEppCausalOrderReadback(config,{read,sku,quantity=1}){
 let baselineAt;
 const site=config.rootUrl.pathname.split('/').filter(Boolean)[2];
 const valid=code=>new RegExp(`^${config.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(code);
 const history=async()=>{
  const data=await read('/users/current/orders?fields=FULL&pageSize=20&currentPage=0&sort=byDate');
  const orders=data.orders||data.searchPageData?.results||data.currentOrders;
  if(!Array.isArray(orders))throw new Error('EPP history shape not proven; no submit retry.');
  return orders;
 };
 return{
  beforeSubmit:async()=>{const codes=new Set((await history()).map(o=>o.code));baselineAt=Date.now();return codes;},
  afterSubmit:async baseline=>{
   const candidates=(await history()).filter(o=>valid(o.code)&&!baseline.has(o.code)&&(typeof o.site==='string'?o.site:o.site?.uid||o.siteUid)===site);
   if(candidates.length!==1)return null;
   const order=await read('/users/current/orders/'+encodeURIComponent(candidates[0].code)+'?fields=FULL');
   if([order.status,order.paymentStatus].some(s=>/CANCEL|REJECT|DECLIN|FAIL/i.test(typeof s==='string'?s:s?.code||'')))return null;
   const created=Number(order.placed||order.created)||Date.parse(order.placed||order.created);
   if(!Number.isFinite(baselineAt)||!Number.isFinite(created)||created<baselineAt-60000||created>Date.now()+60000)return null;
   if(order.code!==candidates[0].code||!Array.isArray(order.entries)||order.entries.length!==1||order.entries[0].product?.code!==sku||order.entries[0].quantity!==quantity||!(order.totalPrice?.value>0))return null;
   return{orderCode:order.code};
  },
 };
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
