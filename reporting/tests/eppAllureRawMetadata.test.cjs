const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
test('EPP reuses executor and trend metadata without mutating raw Allure statuses',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'epp-allure-raw-')),results=path.join(home,'results'),report=path.join(home,'report'),cache=path.join(home,'cache');
 try{
  fs.mkdirSync(results);fs.mkdirSync(path.join(report,'history'),{recursive:true});
  const raw={uuid:'synthetic',name:'SAM-24865',status:'failed',statusDetails:{message:'KNOWN DEFECT SAM-25161'},labels:[{name:'suite',value:'CL EPP'}]};
  const file=path.join(results,'synthetic-result.json'),before=JSON.stringify(raw);fs.writeFileSync(file,before);fs.writeFileSync(path.join(report,'history','history-trend.json'),'[]');
  const env={...process.env,TEST_MARKET:'CL',ENVIRONMENT:'S2',TEST_STORE:'EPP',TEST_SUITE:'official-p1',EPP_PROGRAM:'alianzas',ALLURE_PRESERVE_RAW_STATUS:'1',ALLURE_HISTORY_CACHE_DIR:cache,BUILD_NUMBER:'3'};
  for(const market of ['MX','PE','CO','CL'])delete env[`${market}_QST_ENVIRONMENT`];
  for(const mode of ['prepare','save']){const child=spawnSync(process.execPath,['scripts/prepare-allure-ci-metadata.cjs',results,report,mode],{env,windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);}
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.match(fs.readFileSync(path.join(results,'environment.properties'),'utf8'),/Programme=alianzas/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(results,'executor.json'),'utf8')).type,'jenkins');
  assert.ok(fs.existsSync(path.join(cache,'cl/s2/official-p1/epp/alianzas/full/history/history-trend.json')));
  assert.ok(!fs.existsSync(path.join(cache,'cl/s2/official-p1/base-store')));
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
