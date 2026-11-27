const {expect}=require('@playwright/test');
async function prepareMxClassicBcPdp(page,sku){
 const url=new URL(page.url());
 if(url.origin!=='https://p6-pre-qa2.samsung.com'||!/^SM-[A-Z0-9]+$/.test(sku)||!url.pathname.startsWith('/mx/smartphones/')||!url.pathname.endsWith('-'+sku.toLowerCase()+'/buy/'))throw Error('MX_BC_CLASSIC_PDP_SCOPE_INVALID');
 const color=page.locator(`input[name="pd-color"][data-modelcode="${sku}"]`),memory=page.locator(`input[name="pd-device-memory"][data-modelcode="${sku}"]`);
 const labelFor=async input=>{const id=await input.getAttribute('id');if(!id||!/^[a-z0-9_-]+$/i.test(id))throw Error('MX_BC_VARIANT_LABEL_REQUIRED');return page.locator(`label[for="${id}"]`);};
 await expect(color).toHaveCount(1,{timeout:30000});
 const colorLabel=await labelFor(color);await expect(colorLabel).toBeVisible();await colorLabel.click();await expect(color).toBeChecked();
 await expect(memory).toHaveCount(1);const memoryLabel=await labelFor(memory);await memoryLabel.click();await expect(memory).toBeChecked();await expect(color).toBeChecked();
 const colorText=(await colorLabel.innerText()).trim(),storageText=(await memoryLabel.innerText()).trim();
 const price=Number(await memory.getAttribute('data-modelprice')),renderedPrice=Number(storageText.match(/\$\s*([\d,]+\.\d{2})/)?.[1]?.replace(/,/g,''));
 if(!colorText||!Number.isFinite(price)||price<=0||renderedPrice!==price)throw Error('MX_BC_NATIVE_PRICE_OR_COLOUR_UNPROVEN');
 const trade=page.locator(`input[name="pd-trade-in"][data-modelcode="${sku}"]`);let optedOut=false;
 for(const input of await trade.all()){const label=await labelFor(input);if((await label.innerText()).trim()==='NO'){await label.click();await expect(input).toBeChecked();optedOut=true;break;}}
 if(await trade.count()&&!optedOut)throw Error('MX_BC_TRADE_IN_OPT_OUT_UNAVAILABLE');
 const add=page.locator(`a[an-ac="addToCart"][data-modelcode="${sku}"][canaddtocart="true"]`).filter({visible:true}).first();
 await expect(add).toBeVisible({timeout:30000});await expect(add).toHaveAttribute('data-modelprice',String(price));await expect(color).toBeChecked();await expect(memory).toBeChecked();
 return{add,evidence:{colorText,storageText,price,modelCode:sku}};
}
module.exports={prepareMxClassicBcPdp};
