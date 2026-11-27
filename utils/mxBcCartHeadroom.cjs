const {expect}=require('@playwright/test');

async function prepareMxBcCartHeadroom(page,sku){
 const url=new URL(page.url());
 if(url.origin!=='https://stg2.shop.samsung.com'||url.pathname!=='/mx/cart')throw Error('MX_BC_CART_SCOPE_INVALID');
 if(!/^[A-Z0-9-]+$/.test(sku||''))throw Error('MX_BC_CART_SKU_INVALID');
 const item=page.getByRole('main').locator('cx-cart-item-v2').filter({has:page.getByText(sku,{exact:true})});
 const count=await item.count();if(!count)return{quantityBefore:0,prepared:false};
 if(count!==1)throw Error('MX_BC_CART_TARGET_AMBIGUOUS');
 const quantity=item.getByRole('textbox',{name:'Quantity',exact:true});
 const before=Number(await quantity.inputValue()),rawMax=await quantity.getAttribute('max'),max=rawMax===null||rawMax===''?null:Number(rawMax);
 if(!Number.isInteger(before)||before<1||max!==null&&(!Number.isInteger(max)||max<1||before>max))throw Error('MX_BC_CART_QUANTITY_INVALID');
 if(max===null||before<max)return{quantityBefore:before,prepared:false,max};
 if(max===1)throw Error('MX_BC_CART_HEADROOM_UNAVAILABLE: target already at one-unit limit.');
 const minus=item.getByRole('button',{name:'-',exact:true});await expect(minus).toBeEnabled({timeout:30000});
 const update=page.waitForResponse(r=>{const u=new URL(r.url());return ['https://s2-api-cdn.ecom-stg.samsung.com','https://s2-smb-api-cdn.ecom-stg.samsung.com'].includes(u.origin)&&/^\/tokocommercewebservices\/v2\/mx\/users\/current\/carts\/[^/]+\/entries(?:\/|$)/.test(u.pathname)&&['POST','PUT','PATCH'].includes(r.request().method());},{timeout:30000});
 const [response]=await Promise.all([update,minus.click()]);
 if(!response.ok()||await response.finished())throw Error('MX_BC_CART_HEADROOM_UPDATE_FAILED; no Add submitted.');
 await expect(quantity).toHaveValue(String(before-1),{timeout:30000});
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});
 await expect(quantity).toHaveValue(String(before-1),{timeout:30000});
 return{quantityBefore:before-1,prepared:true,originalQuantity:before,max};
}
module.exports={prepareMxBcCartHeadroom};
