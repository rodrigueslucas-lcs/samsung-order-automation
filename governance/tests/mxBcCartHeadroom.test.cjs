const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('@playwright/test');
const {prepareMxBcCartHeadroom}=require('../../utils/mxBcCartHeadroom.cjs');
const sku='QA-BC-SKU';
async function fixture({initial=5,max=5,status=200,persist=true,absent=false},run){
 const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();let stored=initial,writes=0,loads=0;
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'PUT, OPTIONS','Access-Control-Allow-Headers':'*'};
 if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(r.method()==='PUT'){writes++;if(status===200&&persist)stored--;return route.fulfill({status,headers,contentType:'application/json',body:'{}'});}
 if(u.pathname==='/mx/cart')loads++;
 return route.fulfill({contentType:'text/html',body:`<main>${absent?'':`<cx-cart-item-v2><span>${sku}</span><input aria-label="Quantity" max="${max}" value="${stored}"><button aria-label="-" onclick="fetch('https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/mx/users/current/carts/current/entries/0',{method:'PUT'}).then(r=>{if(r.ok)this.previousElementSibling.value--})">-</button></cx-cart-item-v2>`}<cx-cart-item-v2><span>OTHER-QA-SKU</span><input aria-label="Quantity" value="3"></cx-cart-item-v2></main>`});});
 await page.goto('https://stg2.shop.samsung.com/mx/cart');
 await run({page,read:()=>({stored,writes,loads})});
 }finally{await browser.close();}
}
test('at maximum, prepare one slot only for the exact BC SKU and prove server persistence after reload',async()=>{
 await fixture({},async({page,read})=>{const r=await prepareMxBcCartHeadroom(page,sku);assert.deepEqual(r,{quantityBefore:4,prepared:true,originalQuantity:5,max:5});assert.deepEqual(read(),{stored:4,writes:1,loads:2});assert.equal(await page.locator('cx-cart-item-v2').last().getByRole('textbox').inputValue(),'3');});
});
test('below limit, or absent SKU, no cart mutation or reload is needed',async()=>{
 for(const options of [{initial:2},{absent:true}])await fixture(options,async({page,read})=>{const r=await prepareMxBcCartHeadroom(page,sku);assert.equal(r.prepared,false);assert.equal(read().writes,0);assert.equal(read().loads,1);});
});
test('403 update fails without retry, reload or authorizing Add',async()=>{
 await fixture({status:403},async({page,read})=>{await assert.rejects(prepareMxBcCartHeadroom(page,sku),/HEADROOM_UPDATE_FAILED/);assert.deepEqual(read(),{stored:5,writes:1,loads:1});});
});
test('optimistic UI without persisted decrement fails after reload',async()=>{
 await fixture({persist:false},async({page,read})=>{await assert.rejects(prepareMxBcCartHeadroom(page,sku),/toHaveValue/);assert.equal(read().writes,1);assert.equal(read().stored,5);});
});
test('invalid quantities and one-unit cap never trigger a mutation',async()=>{
 for(const options of [{initial:6},{initial:1,max:1}])await fixture(options,async({page,read})=>{await assert.rejects(prepareMxBcCartHeadroom(page,sku),/QUANTITY_INVALID|HEADROOM_UNAVAILABLE/);assert.equal(read().writes,0);});
});
test('Production, foreign market and non-cart pages fail before inspecting or mutating',async()=>{
 for(const url of ['https://shop.samsung.com/mx/cart','https://stg2.shop.samsung.com/co/cart','https://stg2.shop.samsung.com/mx/checkout/one'])await assert.rejects(prepareMxBcCartHeadroom({url:()=>url},sku),/SCOPE_INVALID/);
});
