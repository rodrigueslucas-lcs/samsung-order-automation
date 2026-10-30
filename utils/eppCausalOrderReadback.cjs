// GET-only reconciliation after a single submit. A previously existing order
// cannot become evidence for a new payment attempt.
function createEppCausalOrderReadback(config,{read,sku,quantity=1}){
 const site=config.rootUrl.pathname.split('/').filter(Boolean)[2];
 const valid=code=>new RegExp(`^${config.market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(code);
 const history=async()=>{
  const data=await read('/users/current/orders?fields=FULL&pageSize=20&currentPage=0&sort=byDate');
  const orders=data.orders||data.searchPageData?.results||data.currentOrders;
  if(!Array.isArray(orders))throw new Error('EPP history shape not proven; no submit retry.');
  return orders;
 };
 return{
  beforeSubmit:async()=>new Set((await history()).map(o=>o.code)),
  afterSubmit:async baseline=>{
   const candidates=(await history()).filter(o=>valid(o.code)&&!baseline.has(o.code)&&(typeof o.site==='string'?o.site:o.site?.uid||o.siteUid)===site);
   if(candidates.length!==1)return null;
   const order=await read('/users/current/orders/'+encodeURIComponent(candidates[0].code)+'?fields=FULL');
   if([order.status,order.paymentStatus].some(s=>/CANCEL|REJECT|DECLIN|FAIL/i.test(typeof s==='string'?s:s?.code||'')))return null;
   if(order.code!==candidates[0].code||!Array.isArray(order.entries)||order.entries.length!==1||order.entries[0].product?.code!==sku||order.entries[0].quantity!==quantity||!(order.totalPrice?.value>0))return null;
   return{orderCode:order.code};
  },
 };
}
module.exports={createEppCausalOrderReadback};
