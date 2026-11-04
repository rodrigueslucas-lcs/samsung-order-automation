const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppStorefront.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
test('PE guest CTA is checked without clicking or proving registered checkout',async()=>{
 const calls=[];
 const node={first(){return this;},filter(){return this;},locator(){return this;},getByRole(){return this;},getByText(){return this;},evaluate:async()=>true};
 const guest={isVisible:async()=>true};
 const expect=target=>({toBeVisible:async()=>{},toBeEnabled:async()=>{assert.equal(target,guest);calls.push('guest-enabled');}});
 expect.poll=()=>({toBe:async()=>{}});
 const run=vm.runInNewContext(source+'\nvalidateEppCartUi;',{expect,test:{}});
 const cart={sku:'QA',currencyPattern:/S\//,continueButton:{isVisible:async()=>false},page:{locator:()=>node,getByRole:(_,opts)=>opts?guest:node},validateCartPage:async()=>{},validateProductInCart:async()=>{},validateOrderSummary:async()=>{},validateCheckoutButton:async()=>{throw Error('Wrong registered CTA');},screenshot:async()=>{}};
 await run(cart,{market:'PE'});assert.deepEqual(calls,['guest-enabled']);
});
test('PE official registered checkout explicitly blocks both sign-in and guest alternatives',()=>{
 const spec=fs.readFileSync('tests/markets/pe/qst/epp/official-safe.spec.js','utf8');
 const block=spec.slice(spec.indexOf('SAM-25125'),spec.indexOf('SAM-25138'));
 assert.match(block,/Samsung Checkout Express/);assert.match(block,/Checkout como invitado/);
 assert.ok(block.indexOf('test.skip(')<block.indexOf('await cart.validateCheckoutButton()'));
 assert.doesNotMatch(block,/checkoutAsGuest|guestCheckoutButton.click/);
});
