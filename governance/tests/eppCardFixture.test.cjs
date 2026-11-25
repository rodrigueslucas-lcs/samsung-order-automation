const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {getEppRuntimeData}=require('../../utils/eppRuntimeData.cjs');
const file=path.resolve('playwright/.auth/epp/cards/qa-credit.json'),cfg={market:'MX',environment:'S2',program:'pymesmx'};
const original={contact:{firstName:'QA'},delivery:{region:'QA'},payment:{card:{number:'unchanged'},other:'preserved'}};
const body={S2:{MX:original,PE:original},S1:{MX:original}};
function fixture(brand='amex'){return{market:'MX',environment:'S2',program:'pymesmx',provider:'mercadopago',type:'credit',scenario:'approved',brand,id:'synthetic-'+brand,card:{number:brand==='amex'?'37'+'1'.repeat(13):brand==='visa'?'4'+'1'.repeat(15):'54'+'1'.repeat(14),cvv:'1'.repeat(brand==='amex'?4:3),expiry:'11/30',holderName:'APRO',document:'synthetic-document'}};}
function io(value){return{existsSync:()=>true,readFileSync:p=>JSON.stringify(p===file?value:body)};}
for(const brand of ['amex','visa','mastercard'])test('explicit ignored '+brand+' fixture preserves all contact/delivery data and default objects',()=>{
 const next=getEppRuntimeData(cfg,io(fixture(brand)),{MX_EPP_TEST_CARD_FILE:file});
 assert.deepEqual(next.contact,original.contact);assert.deepEqual(next.delivery,original.delivery);assert.equal(next.payment.other,'preserved');assert.equal(next.payment.cardFixture.brand,brand);assert.equal(original.payment.card.number,'unchanged');
 assert.deepEqual(Object.keys(next.payment.cardFixture).sort(),['brand','id','provider','type']);
});
test('unset override retains default and a market-specific variable cannot affect PE',()=>{assert.deepEqual(getEppRuntimeData(cfg,io(null),{}),original);assert.deepEqual(getEppRuntimeData({...cfg,market:'PE'},io(null),{MX_EPP_TEST_CARD_FILE:file}),original);});
test('only the five approved card fields can reach the payment adapter',()=>{const f=fixture();f.card.unrelated='must-not-propagate';const data=getEppRuntimeData(cfg,io(f),{MX_EPP_TEST_CARD_FILE:file});assert.deepEqual(Object.keys(data.payment.card).sort(),['cvv','document','expiry','holderName','number']);});
for(const change of [{environment:'S1'},{program:'other'},{market:'CL'},{provider:'other'},{type:'debit'},{scenario:'declined'},{id:'private@example.test'},{brand:'unknown'}])test('mismatched fixture fails without printing contents '+JSON.stringify(change),()=>{assert.throws(()=>getEppRuntimeData(cfg,io({...fixture(),...change}),{MX_EPP_TEST_CARD_FILE:file}),/MX_EPP_CARD_SCOPE_INVALID/);});
test('S1 cannot consume a configured S2 fixture',()=>{assert.throws(()=>getEppRuntimeData({...cfg,environment:'S1'},io(fixture()),{MX_EPP_TEST_CARD_FILE:file}),/MX_EPP_CARD_SCOPE_INVALID/);});
test('fixture path cannot escape the ignored private cards directory',()=>{assert.throws(()=>getEppRuntimeData(cfg,io(fixture()),{MX_EPP_TEST_CARD_FILE:path.resolve('.env')}),/MX_EPP_CARD_FILE_INVALID/);});
test('null or incomplete card fails before tokenization',()=>{for(const f of [null,{...fixture(),card:null},{...fixture(),card:{...fixture().card,cvv:''}}])assert.throws(()=>getEppRuntimeData(cfg,io(f),{MX_EPP_TEST_CARD_FILE:file}),/MX_EPP_CARD_/);});
test('wrong brand length, security-code length and holder scenario fail without values',()=>{for(const change of [{number:'invalid'},{cvv:'123'},{holderName:'OTHE'},{expiry:'13/30'}])assert.throws(()=>getEppRuntimeData(cfg,io({...fixture(),card:{...fixture().card,...change}}),{MX_EPP_TEST_CARD_FILE:file}),/^Error: MX_EPP_CARD_DATA_INVALID:/);});
