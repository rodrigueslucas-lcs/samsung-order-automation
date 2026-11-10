const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {initialize}=require('../../scripts/initialize-epp-jenkins.cjs');
const {publishInfraFallback}=require('../../scripts/finalize-epp-jenkins.cjs');
test('early CI failure publishes only current official NOT_RUN and INFRA_ERROR without dependencies or credentials',()=>{
 const original=process.cwd(),home=fs.mkdtempSync(path.join(os.tmpdir(),'epp-infra-fallback-'));
 try{
  process.chdir(home);fs.mkdirSync('reporting/executive-v3',{recursive:true});fs.copyFileSync(path.join(original,'reporting/executive-v3/dashboard.css'),'reporting/executive-v3/dashboard.css');
  fs.mkdirSync('reporting/epp-quality',{recursive:true});fs.copyFileSync(path.join(original,'reporting/epp-quality/dashboard-theme.css'),'reporting/epp-quality/dashboard-theme.css');
  const env={CI:'1',ENVIRONMENT:'S2',TEST_MARKET:'CL',BUILD_NUMBER:'123'};
  const manifest=initialize(env),model=publishInfraFallback(env);
  assert.equal(model.gate,'INFRA_ERROR');assert.equal(model.counts.NOT_RUN,7);assert.equal(model.executed,0);assert.equal(model.orders.length,0);
  const publication=JSON.parse(fs.readFileSync(path.join(manifest.output,'public/publication.json'),'utf8'));assert.equal(publication.infrastructureOnly,true);
  assert.throws(()=>publishInfraFallback(env),/Existing public artifacts/);
  assert.throws(()=>publishInfraFallback({...env,BUILD_NUMBER:'122'}),/mismatch/);
 }finally{process.chdir(original);fs.rmSync(home,{recursive:true,force:true});}
});
test('initialization refuses non-CI, another environment or an unpinned market',()=>{
 for(const env of [{CI:'0',ENVIRONMENT:'S2',TEST_MARKET:'CL',BUILD_NUMBER:'1'},{CI:'1',ENVIRONMENT:'S1',TEST_MARKET:'CL',BUILD_NUMBER:'1'},{CI:'1',ENVIRONMENT:'S2',TEST_MARKET:'XX',BUILD_NUMBER:'1'}])assert.throws(()=>initialize(env),/scope/);
});
