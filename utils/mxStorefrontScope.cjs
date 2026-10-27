function resolveMxStorefrontScope(value, storefront=null, resource='cart') {
  if(!['cart','checkout/one'].includes(resource))throw new Error('Unsupported MX storefront resource.');
  const url=new URL(value), hosts=['stg.shop.samsung.com','stg2.shop.samsung.com'];
  let path='/mx/'+resource, site='mx';
  if(storefront){
    const expected=require('../config/markets/epp').getEppConfig('MX',{ENVIRONMENT:storefront.environment});
    if(storefront.market!=='MX'||storefront.rootUrl.href!==expected.rootUrl.href||url.origin!==expected.rootUrl.origin)throw new Error('MX EPP requires the selected known staging programme.');
    path=new URL(resource,expected.rootUrl).pathname;site=expected.rootUrl.pathname.split('/').filter(Boolean)[2];
  }
  if(url.protocol!=='https:'||!hosts.includes(url.hostname)||url.port||url.pathname!==path)throw new Error('MX flow requires the configured staging MX checkout or staging cart.');
  const apiOrigin=`https://${url.hostname.startsWith('stg2.')?'s2':'s1'}-smb-api-cdn.ecom-stg.samsung.com`;
  return {url,site,apiOrigin,cartPath:`/tokocommercewebservices/v2/${site}/users/current/carts/current`};
}
module.exports={resolveMxStorefrontScope};
