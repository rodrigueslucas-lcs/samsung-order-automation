const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {runCi}=require('../../scripts/run-epp-jenkins.cjs');
test('CO S2 reuses the explicitly scoped provider fixture without a local default dependency',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'epp-provider-fixture-'));
 try{
  const file=path.join(folder,'card.json'),fixture={number:'synthetic-number',holderName:'Synthetic QA',expiry:'synthetic-expiry',cvv:'synthetic-cvv',document:'synthetic-document'};
  fs.writeFileSync(file,JSON.stringify(fixture));
  const env={CO_QST_ENVIRONMENT:'S2',ENVIRONMENT:'S2',MX_TEST_CARD_FILE:file};
  assert.deepEqual(require('../../utils/mxTestCard.js').getMxTestCard(env),fixture);
  assert.deepEqual(require('../../utils/coTestCard.js').getCoTestCard(env),fixture);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
function scenario(run){const home=fs.mkdtempSync(path.join(os.tmpdir(),'epp-ci-'));const output=path.join(home,'results'),authority=path.join(home,'.auth/epp');const files=new Map();const io={existsSync:p=>p===authority||p==='bundle'||files.has(p),mkdirSync:()=>{},writeFileSync:(p,v)=>files.set(p,v),readFileSync:p=>files.get(p),copyFileSync:()=>{}};const build=(market,args,env)=>({env:{...env,EPP_RUN_ID:'build-1'},output,command:[],ids:[]});const model=()=>{const manifest=JSON.parse(files.get(path.resolve('test-results/epp-ci-current.json')));return JSON.parse(files.get(path.join(manifest.privateOutput,'quality/quality.json')));};try{return run({home,output,files,io,build,authority,model});}finally{fs.rmSync(home,{recursive:true,force:true});}}
test('invalid CI market/environment cannot launch tests',()=>{assert.throws(()=>runCi('XX',{CI:'1',ENVIRONMENT:'S2'}));assert.throws(()=>runCi('CL',{CI:'1',ENVIRONMENT:'S1'}));});
test('missing authority reports all official tests and never executes payment',()=>scenario(({io,build,model})=>{let executed=0;const exit=runCi('CL',{CI:'1',ENVIRONMENT:'S2'},{io,build,execute:()=>{executed++;return 0;},summarize:()=>{}});assert.equal(exit,1);assert.equal(executed,0);const m=model();assert.equal(m.official,7);assert.equal(m.counts.NOT_RUN,7);assert.equal(m.gate,'INFRA_ERROR');}));
test('launch error preserves an infra report instead of fake app defect',()=>scenario(({io,build,authority,model})=>{let executed=0;runCi('PE',{CI:'1',ENVIRONMENT:'S2',EPP_CI_AUTHORITY_ROOT:authority,EPP_SESSION_BUNDLE_FILE:'bundle'},{io,build,execute:()=>{executed++;throw new Error('unavailable');},summarize:()=>{}});assert.equal(executed,1);assert.equal(model().counts.FAIL,0);assert.equal(model().gate,'INFRA_ERROR');}));
test('CI pins FIRST, NORMAL and headless while isolating all diagnostics',()=>scenario(({io,build,authority,files,model})=>{
 const exit=runCi('CL',{CI:'1',ENVIRONMENT:'S2',EPP_CI_AUTHORITY_ROOT:authority,EPP_SESSION_BUNDLE_FILE:'bundle',EPP_AUTH_SLOT:'second',EPP_RESUME_PENDING_ORDER:'1',BROWSER_MODE:'headed'},{io,build,summarize:()=>{},execute:run=>{
  assert.equal(run.env.EPP_AUTH_SLOT,'primary');assert.equal(run.env.EPP_RESUME_PENDING_ORDER,'0');assert.equal(run.env.BROWSER_MODE,'headless');assert.ok(path.relative(process.cwd(),run.output).startsWith('..')||path.isAbsolute(path.relative(process.cwd(),run.output)));
  const ids=require('../../scripts/report-epp-homologation.cjs').inventory().filter(r=>r.market==='CL');
  files.set(path.join(run.output,'results.json'),JSON.stringify({config:{metadata:{epp:{market:'CL',environment:'S2',program:'alianzas',runId:run.env.EPP_RUN_ID}}},suites:[{specs:ids.map(r=>({title:r.tc,tests:[{results:[{status:'passed',duration:1}]}]}))}]}));return 0;
 }});assert.equal(exit,0);assert.equal(model().counts.PASS,7);
}));
