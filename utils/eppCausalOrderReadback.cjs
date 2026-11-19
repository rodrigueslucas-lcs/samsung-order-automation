// GET-only reconciliation after a single submit. A previously existing order
// cannot become evidence for a new payment attempt.
function createEppCausalOrderReadback(config,{read,sku,quantity=1}){
 const site=config.rootUrl.pathname.split('/').filter(Boolean)[2];
 return require('./causalOrderReadback.cjs').createCausalOrderReadback({market:config.market,site},{read,sku,quantity});
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
