const{test}=require('node:test');const assert=require('node:assert/strict');
const{openSecondAccountQr}=require('../../utils/authAccountQr.cjs');
function fixture({url='https://account.samsung.com/accounts/fixture',scan=false,button=true,link=false,href='/accounts/qr',fail=false}={}) {
 const calls=[];const loc=(visible,role)=>({filter(){return this;},first(){return this;},isVisible:async()=>visible,getAttribute:async()=>href,click:async()=>{calls.push(role);if(fail)throw Error('fixture navigation');}});
 return{calls,page:{url:()=>url,getByText:()=>loc(scan,'scan'),getByRole:role=>loc(role==='button'?button:link,role)}};
}
test('FIRST never opens QR or reads provider controls',async()=>{assert.equal(await openSecondAccountQr({url(){throw Error('must not inspect FIRST');}},{slot:'primary'}),false);});
test('SECOND selects the normal QR button once without credentials',async()=>{const s=fixture();assert.equal(await openSecondAccountQr(s.page,{slot:'second',log(){}}),true);assert.deepEqual(s.calls,['button']);});
test('already open QR requires no further click',async()=>{const s=fixture({scan:true});assert.equal(await openSecondAccountQr(s.page,{slot:'second',log(){}}),true);assert.deepEqual(s.calls,[]);});
test('foreign or insecure pages cannot receive QR actions',async()=>{for(const url of ['http://account.samsung.com/accounts','https://foreign.example/']){const s=fixture({url});assert.equal(await openSecondAccountQr(s.page,{slot:'second',log(){}}),false);assert.deepEqual(s.calls,[]);}});
test('QR links must remain on the official provider origin',async()=>{for(const [href,expected]of [['/accounts/qr',true],['https://foreign.example/qr',false],['javascript:alert(1)',false]]){const s=fixture({button:false,link:true,href});assert.equal(await openSecondAccountQr(s.page,{slot:'second',log(){}}),expected);}});
test('missing QR and ambiguous click never retry or fail manual login',async()=>{const missing=fixture({button:false});assert.equal(await openSecondAccountQr(missing.page,{slot:'second',log(){}}),false);const ambiguous=fixture({fail:true});assert.equal(await openSecondAccountQr(ambiguous.page,{slot:'second',log(){}}),false);assert.deepEqual(ambiguous.calls,['button']);});
