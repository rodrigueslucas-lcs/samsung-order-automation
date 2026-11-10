const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {catalog,copyAndPolish,businessDescription,tcFrom}=require('../epp-quality/allure-business.cjs');
const {inventory}=require('../../scripts/report-epp-homologation.cjs');

function withDirs(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'epp-allure-parity-'));
 const source=path.join(root,'allure'),destination=path.join(root,'presentation');
 fs.mkdirSync(source);
 try{return fn({root,source,destination});}finally{fs.rmSync(root,{recursive:true,force:true});}
}
function sample(tc,{status='passed',message='',steps=null,attachments=[]}={}){
 return {uuid:'uuid-'+tc,historyId:'stable-'+tc,name:tc+' @qst @epp @safe - technical source title',fullName:'test/markets/epp/'+tc,
  status,statusDetails:{message,trace:'technical-trace'},labels:[{name:'suite',value:'EPP - isolated Chromium'},{name:'tag',value:'qst'}],
  parameters:[{name:'Project',value:'EPP - isolated Chromium'},{name:'Payment',value:'card'}],
  steps:steps||[{name:'Before Hooks',status:'passed',attachments:[{source:'original.png',type:'image/png',name:'screenshot'}],steps:[]},
    {name:'Execute the official business journey',status:'passed',steps:[],attachments:[]},
    {name:'After Hooks',status:'passed',steps:[],attachments:[]}],
  attachments
 };
}
function save(source,result){fs.writeFileSync(path.join(source,result.uuid+'-result.json'),JSON.stringify(result));}
function read(source,result){return JSON.parse(fs.readFileSync(path.join(source,result.uuid+'-result.json'),'utf8'));}

test('catalog covers all 26 official EPP testcases with no missing or foreign IDs',()=>{
 const cases=inventory().filter(r=>r.market in {MX:1,PE:1,CL:1,CO:1});
 assert.equal(cases.length,26);assert.equal(Object.keys(catalog).length,26);
 for(const row of cases){
  const item=catalog[row.tc];
  assert.ok(item,'Missing '+row.tc);assert.equal(item.market,row.market);
  for(const field of ['title','objective','expected','feature'])assert.ok(item[field].length>8,row.tc+' '+field);
  assert.ok(Array.isArray(item.steps)&&item.steps.length>=3,row.tc+' expected business checkpoints');
 }
 assert.deepEqual(Object.fromEntries(['MX','PE','CL','CO'].map(m=>[m,Object.values(catalog).filter(c=>c.market===m).length])),{MX:7,PE:6,CL:7,CO:6});
});
test('copy enriches Allure UI but preserves source bytes, original statuses, history and failure diagnostics',()=>withDirs(({source,destination})=>{
 const failing=sample('SAM-25020',{status:'failed',message:'TimeoutError: locator.click: Timeout 15000ms exceeded.\nCall log:\n - intercepted by header'});
 const original=JSON.stringify(failing);save(source,failing);fs.writeFileSync(path.join(source,'original.png'),'synthetic');
 const done=copyAndPolish(source,destination,{market:'MX',rows:[{tc:'SAM-25020',quality:'FAIL'}]});
 assert.deepEqual(done.caseIds,['SAM-25020']);
 assert.equal(fs.readFileSync(path.join(source,failing.uuid+'-result.json'),'utf8'),original);
 const polished=read(destination,failing);
 assert.equal(polished.status,'failed');assert.equal(polished.historyId,'stable-SAM-25020');assert.equal(polished.uuid,failing.uuid);
 assert.equal(polished.name,'SAM-25020 · Product variants / selectors');
 assert.equal(polished.labels.find(l=>l.name==='suite').value,'EPP · Official QST');
 assert.ok(polished.labels.some(l=>l.name==='subSuite'&&l.value==='Product & Catalog'));
 assert.ok(!polished.labels.some(l=>l.value==='EPP - isolated Chromium'));
 assert.equal(polished.parameters.find(p=>p.name==='Project').mode,'hidden');
 assert.match(polished.descriptionHtml,/O que foi validado/);
 assert.match(polished.descriptionHtml,/Resultado esperado/);
 assert.match(polished.descriptionHtml,/Resultado observado/);
 assert.match(polished.descriptionHtml,/Contexto da execução/);
 assert.match(polished.descriptionHtml,/Passos registrados nesta execução/);
 assert.match(polished.descriptionHtml,/Roteiro funcional esperado/);
 assert.match(polished.descriptionHtml,/etapas previstas, não comprovação de execução/);
 assert.equal(polished.steps.length,1);assert.equal(polished.steps[0].name,'Execute the official business journey');
 assert.ok(polished.attachments.some(a=>a.name==='screenshot'));
 const diagnostic=polished.attachments.find(a=>a.name==='Full Playwright failure diagnostic');
 assert.ok(diagnostic);assert.match(fs.readFileSync(path.join(destination,diagnostic.source),'utf8'),/intercepted by header/);
 assert.doesNotMatch(polished.statusDetails.message,/Call log:/);
 assert.match(polished.statusDetails.message,/Full technical details/);
}));
test('known defect and blocked cases retain native Playwright status',()=>withDirs(({source,destination})=>{
 const defect=sample('SAM-25046',{status:'skipped',message:'MX_EPP_CASH_TRANSACTION_FAILED'});
 save(source,defect);
 copyAndPolish(source,destination,{market:'MX',rows:[{tc:'SAM-25046',quality:'KNOWN_DEFECT'}]});
 const displayed=read(destination,defect);
 assert.equal(displayed.status,'skipped');
 assert.match(displayed.descriptionHtml,/KNOWN DEFECT · SKIPPED/);
 assert.match(displayed.descriptionHtml,/not a PASS/i);
 assert.equal(displayed.historyId,'stable-SAM-25046');
}));
test('all four markets have friendly suites and market flags, without chromium in visible hierarchy',()=>{
 for(const market of ['MX','PE','CL','CO'])withDirs(({source,destination})=>{
  const entry=Object.values(catalog).find(c=>c.market===market);
  const sourceResult=sample(entry.id);
  save(source,sourceResult);
  copyAndPolish(source,destination,{market,rows:[{tc:entry.id,quality:'PASS'}]});
  const displayed=read(destination,sourceResult);
  const labels=displayed.labels.map(l=>l.value);
  assert.ok(labels.includes('EPP · Official QST'));
  assert.ok(labels.some(value=>value.includes(market+' · S2')));
  assert.ok(!labels.includes('EPP - isolated Chromium'));
  assert.equal(displayed.status,'passed');
  assert.match(displayed.descriptionHtml,/Recorded Playwright assertions passed/);
 });
});
test('refuses to mix historical/cross-market or duplicate cases',()=>{
 withDirs(({source,destination})=>{save(source,sample('SAM-25138'));assert.throws(()=>copyAndPolish(source,destination,{market:'MX'}),/foreign official/);});
 withDirs(({source,destination})=>{
  const entry=sample('SAM-25020');save(source,entry);fs.writeFileSync(path.join(source,'duplicate-result.json'),JSON.stringify({...entry,uuid:'other'}));
  assert.throws(()=>copyAndPolish(source,destination,{market:'MX'}),/Duplicate official/);
 });
});
test('business description escapes untrusted execution text and preserves accurate observability',()=>{
 const item=catalog['SAM-24952'];
 const html=businessDescription(item,{status:'failed',steps:[],statusDetails:{message:'<script>alert(1)</script>'}},'TEST_DATA_REQUIRED');
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/TEST DATA REQUIRED · FAIL/);
});
test('source TC identification only uses official SAM IDs',()=>{
 assert.equal(tcFrom({name:'SAM-25140 @qst @epp'}),'SAM-25140');
 assert.equal(tcFrom({name:'Unrelated test'}),null);
});
