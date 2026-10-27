const test=require('node:test'),assert=require('node:assert/strict');
const {resolveMxStorefrontScope:resolve}=require('../../utils/mxStorefrontScope.cjs');
const {getEppConfig}=require('../../config/markets/epp');
for(const environment of ['S1','S2'])test(`${environment} binds Base Store and EPP to distinct cart/checkout contracts`,()=>{
 const cfg=getEppConfig('MX',{ENVIRONMENT:environment});
 assert.equal(resolve(new URL('/mx/cart',cfg.rootUrl).href).site,'mx');
 const expected=environment==='S1'?'mxtotalplay':'pymesmx';
 assert.equal(resolve(cfg.cartUrl.href,cfg).site,expected);
 assert.equal(resolve(new URL('checkout/one',cfg.rootUrl).href,cfg,'checkout/one').cartPath,`/tokocommercewebservices/v2/${expected}/users/current/carts/current`);
});
test('EPP scope refuses foreign host, programme, market and Base Store substitutions',()=>{
 const cfg=getEppConfig('MX',{ENVIRONMENT:'S2'});
 for(const url of ['https://www.samsung.com/mx/cart','https://stg.shop.samsung.com/mx/cart','https://stg2.shop.samsung.com/mx/cart','https://stg2.shop.samsung.com/mx/multistore/other/other/cart'])assert.throws(()=>resolve(url,cfg));
 assert.throws(()=>resolve(cfg.cartUrl.href,{...cfg,market:'CO'}));
});
