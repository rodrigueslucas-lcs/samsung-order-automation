const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('tests/markets/co/qst/base-store/official-p1.spec.js','utf8');
const start=source.indexOf('async function coFillNewShipping(');
const end=source.indexOf('async function coFillNewBilling(',start);

function scenario({direct=false,hydrating=false,replaceDuringClick=false,selectionFails=false}={}){
  let visible=direct,clicks=0,fills=0;
  const failure=new Error('Address selection failed');
  const department={isVisible:async()=>visible,waitFor:async()=>{
    if(hydrating)visible=true;
    if(visible)return;
    return new Promise(()=>{});
  }};
  const radio={waitFor:async()=>{
    if(direct||hydrating)return new Promise(()=>{});
  }};
  const fill={fill:async()=>{assert.equal(visible,true);fills++;}};
  const delivery={locator:selector=>selector.includes('regionIso')?department:selector.includes('addressOptionShipping')?radio:fill};
  const run=vm.runInNewContext(`${source.slice(start,end)}\ncoFillNewShipping;`,{
    expect:locator=>({toBeVisible:async()=>assert.equal(await locator.isVisible(),true)}),
    coSelectAddressMode:async()=>{
      clicks++;
      if(replaceDuringClick){visible=true;throw failure;}
      if(selectionFails)throw failure;
      visible=true;
    },
    coSelectOption:async()=>assert.equal(visible,true),
  });
  return{run:()=>run({},delivery),clicks:()=>clicks,fills:()=>fills,failure};
}

for(const options of [{direct:true},{hydrating:true}])test(`CO direct/hydrating guest form avoids the obsolete radio (${JSON.stringify(options)})`,async()=>{
  const s=scenario(options);await s.run();assert.equal(s.clicks(),0);assert.equal(s.fills(),4);
});
test('CO registered saved-address mode still selects the new-address radio',async()=>{
  const s=scenario();await s.run();assert.equal(s.clicks(),1);
});
test('CO radio can disappear only when replaced by a visible editable form',async()=>{
  const s=scenario({replaceDuringClick:true});await s.run();assert.equal(s.fills(),4);
});
test('CO propagates address selection errors when no replacement form exists',async()=>{
  const s=scenario({selectionFails:true});await assert.rejects(s.run(),s.failure);assert.equal(s.fills(),0);
});
