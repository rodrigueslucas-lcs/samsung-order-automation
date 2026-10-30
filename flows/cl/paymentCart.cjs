function validateClPaymentCartTarget(config) {
  const url = new URL(config.cartUrl);
  const hosts = { S1: 'stg.shop.samsung.com', S2: 'stg2.shop.samsung.com' };
  const store=config.storefront;
  if(store){
    const root=new URL(store.rootUrl);
    if(store.market!=='CL'||store.environment!==config.environment||root.protocol!=='https:'||root.hostname!==hosts[config.environment]||root.port||root.username||root.password||root.search||root.hash||url.href!==new URL('cart',root).href)throw new Error('CL EPP payment cart must match its canonical staging programme.');
    const programme=require('../../config/markets/epp').getEppPrograms('CL',config.environment).find(item=>item.canonicalUrl===root.href);
    if(!programme||(store.program&&store.program!==programme.id))throw new Error('CL EPP payment cart must match its canonical staging programme.');
    return `https://${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${programme.id}/users/current/carts/current`;
  }
  if (!hosts[config.environment] || url.protocol !== 'https:' || url.hostname !== hosts[config.environment] || url.pathname !== '/cl/cart') {
    throw new Error('CL payment cart preparation requires the S1/S2 staging cart.');
  }
  return `https://${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/cl/users/current/carts/current`;
}

async function normalizeClPaymentQuantity(page,cart,{readBack=null}={}){
  const {expect}=require('@playwright/test');
  const quantity=page.getByRole('textbox',{name:'Quantity'}).filter({visible:true});
  await expect(quantity).toHaveCount(1,{timeout:30000});
  const initial=Number(await quantity.inputValue());
  if(!Number.isInteger(initial)||initial<1||initial>20)throw new Error('CL order test requires one controlled cart row with 1–20 units before normalization.');
  const decrease=page.getByRole('button',{name:'-',exact:true}).filter({visible:true});
  for(let count=initial;count>1;count--){
    await decrease.click();await cart.waitForQuantityValue(quantity,String(count-1));
    if(readBack)await expect.poll(async()=>{const state=await readBack();return state.entries.length===1&&state.entries[0].product?.code===cart.sku?state.entries[0].quantity:null;},{timeout:20000}).toBe(count-1);
  }
  await expect(quantity).toHaveValue('1');
}

async function prepareClPaymentCart(page, config, {observedResponse=null}={}) {
  const api = validateClPaymentCartTarget(config);
  const endpoint = new URL(api);
  const inPlace=config.storefront&&observedResponse;
  if(inPlace){
    const observed=new URL(observedResponse.url());
    if(observed.origin!==endpoint.origin||observed.pathname!==endpoint.pathname||observedResponse.request().method()!=='GET')throw new Error('CL EPP cart evidence belongs to another endpoint.');
  }
  const read = async () => {
    let response;
    if(inPlace){
      const authorization=await observedResponse.request().headerValue('authorization');
      response=await page.context().request.get(api,{headers:authorization?{authorization}:{},timeout:30000,maxRedirects:0}).catch(()=>{throw new Error('CL EPP cart read failed; request details suppressed.');});
    }else{
    const pending = page.waitForResponse(r => {
      const url = new URL(r.url());
      return r.request().method() === 'GET' && url.origin === endpoint.origin && url.pathname === endpoint.pathname;
    }, { timeout: 60000 });
    await page.goto(config.cartUrl.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    response = await pending;
    }
    if (!response.ok()) throw new Error(`CL payment cart read failed: HTTP ${response.status()}.`);
    const cart = await response.json();
    if (!Array.isArray(cart.entries) || cart.entries.length > 10) throw new Error('CL payment cart has an unsupported entry schema or more than ten entries.');
    return { cart, response:inPlace?observedResponse:response };
  };
  let state = await read();
  const removed = new Set();
  for (let n = 0; n < 10; n++) {
    const other = state.cart.entries.find(entry => entry.product?.code !== config.sku && !entry.isServiceEntry);
    if (!other) {
      if (state.cart.entries.some(entry => entry.isServiceEntry)) throw new Error('CL card test requires a product-only cart, without added services.');
      return inPlace?{readCart:async()=>(await read()).cart}:undefined;
    }
    if (!Number.isInteger(other.entryNumber) || !other.product?.code || removed.has(other.product.code)) {
      throw new Error('CL cart removal did not persist or entry identity is invalid; no deletion will be retried.');
    }
    removed.add(other.product.code);
    const authorization = await state.response.request().headerValue('authorization');
    const response = await page.context().request.delete(`${api}/entries/${other.entryNumber}`, {
      headers: authorization ? { authorization } : {}, timeout: 30000, maxRedirects:0,
    });
    if (!response.ok()) throw new Error(`CL payment cart removal failed: HTTP ${response.status()}.`);
    state = await read();
    if (state.cart.entries.some(entry => entry.product?.code === other.product.code)) {
      throw new Error('CL payment cart still contains the removed product; no deletion will be retried.');
    }
  }
  throw new Error('CL payment cart preparation exceeded ten product removals.');
}

module.exports = { prepareClPaymentCart, validateClPaymentCartTarget, normalizeClPaymentQuantity };
