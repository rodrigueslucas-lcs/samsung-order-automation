const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppStorefront.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({headings=0,links=0,productFailure=false}={}){
 const annotations=[],calls=[];
 const node={filter(){return this;},first(){return this;},locator(){return this;},getByRole(){return this;},getByText(){return this;},evaluate:async()=>true};
 const footer={count:async()=>1,getByRole:(role,options)=>({missing:!!options,filter:()=>({count:async()=>role==='heading'?headings:links})})};
 const expect=locator=>({toBeVisible:async()=>{if(locator.missing)throw Error('footer mismatch');if(productFailure)throw Error('product failure');}});
 expect.poll=()=>({toBe:async()=>{}});
 const run=vm.runInNewContext(source+'\nvalidateEppCartUi;',{expect,test:{info:()=>({annotations,attach:async()=>calls.push('signature')}),skip:()=>{calls.push('quarantine');throw Error('known-footer');}}});
 const cart={sku:'QA',currencyPattern:/\$/,page:{locator:()=>node,getByRole:()=>footer},validateCartPage:async()=>calls.push('cart'),validateProductInCart:async()=>calls.push('product'),validateOrderSummary:async()=>calls.push('summary'),validateCheckoutButton:async()=>calls.push('checkout'),screenshot:async()=>calls.push('screenshot')};
 return{calls,annotations,run:cfg=>run(cart,cfg)};
}
test('only the observed empty CL S2 alianzas footer is quarantined after all cart business checks',async()=>{
 const f=fixture();await assert.rejects(f.run({market:'CL',environment:'S2',program:'alianzas'}),/known-footer/);
 assert.deepEqual(f.calls,['cart','product','summary','checkout','screenshot','signature','quarantine']);
 assert.equal(f.annotations[0].type,'known-defect');assert.match(f.annotations[0].description,/SAM-25146/);
});
test('partial footer, another market/programme and product errors remain failures',async()=>{
 for(const [options,cfg] of [[{headings:1},{market:'CL',environment:'S2',program:'alianzas'}],[{links:1},{market:'CL',environment:'S2',program:'alianzas'}],[{},{market:'MX',environment:'S2',program:'pymesmx'}],[{},{market:'CL',environment:'S1',program:'alianzas'}],[{},{market:'CL',environment:'S2',program:'colaboradores'}],[{productFailure:true},{market:'CL',environment:'S2',program:'alianzas'}]]){
  const f=fixture(options);await assert.rejects(f.run(cfg),/footer mismatch|product failure/);assert.ok(!f.calls.includes('quarantine'));
 }
});
