const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppPaymentPrerequisites.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({accepted=true,empty=true,code=601,program='pymesmx'}={}){
 const calls=[];let record={market:'MX',environment:'S2',kind:'card',status:'SUBMITTING',at:'2026-11-24T12:00:00Z',providerBusinessCode:code};
 const cfg={market:'MX',environment:'S2',program,pdpUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/p/QA'),rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/'),cartUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/cart')};
 const response={url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pymesmx/users/current/carts/current',request:()=>({method:()=> 'GET'})};
 const page={context:()=>({}),waitForResponse:async predicate=>{assert.equal(predicate(response),true);return response;},goto:async url=>{assert.equal(url,cfg.cartUrl.href);calls.push('cart');}};
 const run=vm.runInNewContext(source+'\nrunEppPaymentPrerequisiteCase;',{
  URL,process:{env:{}},test:{setTimeout(){},info:()=>({annotations:[]})},session:{getPrimaryEppCredentials:()=>({email:'qa@example.test'})},
  server:{watchEppServerProof:(_context,_cfg,opts)=>{assert.equal(opts.expectedEmail,'qa@example.test');return{accepted:()=>accepted,settle:async()=>{},stop:()=>calls.push('stop')};}},
  openEppStore:async()=>calls.push('open'),causalReadback:{createEppReadbackFromCartResponse:async()=>({proveNoOrderSince:async at=>{assert.equal(at,record.at);calls.push('history');return empty?{attemptAt:at,historyComplete:true,candidates:[]}:null;}})},
  attempts:{pendingEppOrderAttempt:(_cfg,kind)=>kind==='card'?record:null,archiveRejectedEppOrderAttempt:(_cfg,kind,proof)=>{assert.equal(kind,'card');assert.equal(proof.providerBusinessCode,601);record=null;calls.push('archive');}},
 });
 return{calls,run:()=>run(page,cfg,{kind:'card'})};
}
test('a recorded rejection is reconciled read-only before normal new-order guards',async()=>{const f=fixture();await assert.rejects(f.run(),/PAYMENT_SUBMIT_NOT_AUTHORIZED/);assert.deepEqual(f.calls,['open','cart','history','archive','stop']);});
test('a possibly created order keeps the durable guard and never submits again',async()=>{const f=fixture({empty:false});await assert.rejects(f.run(),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(f.calls,['open','cart','history','stop']);});
test('reconciliation refuses an unaccepted identity before visiting cart',async()=>{const f=fixture({accepted:false});await assert.rejects(f.run(),/AUTH_OR_ENTITLEMENT_REQUIRED/);assert.deepEqual(f.calls,['open','stop']);});
for(const options of [{code:null},{code:500},{program:'other'}])test('unknown outcome or another programme is never released '+JSON.stringify(options),async()=>{const f=fixture(options);await assert.rejects(f.run(),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(f.calls,[]);});
