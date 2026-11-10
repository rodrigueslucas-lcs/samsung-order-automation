const fs=require('node:fs'),path=require('node:path');
const {buildModel}=require('../reporting/epp-quality/model.cjs');
const {render}=require('../reporting/epp-quality/render.cjs');
function publicExecution(manifest){return {schemaVersion:1,market:manifest.market,environment:manifest.environment,program:manifest.program,runId:manifest.runId,buildNumber:manifest.buildNumber,gitCommit:/^[a-f0-9]{40}$/i.test(manifest.gitCommit||'')?manifest.gitCommit:null};}
function cleanupPrivateWorkspace(workspace=process.cwd(),io=fs){
  const base=io.realpathSync(workspace),target=path.resolve(workspace,'playwright/.auth/epp');
  if(!io.existsSync(target))return;
  const actual=io.realpathSync(target),relative=path.relative(base,actual);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||actual!==target)throw new Error('Private CI cleanup target escapes its workspace.');
  function inspect(folder){for(const item of io.readdirSync(folder,{withFileTypes:true})){
    if(item.isSymbolicLink()||/^order-attempt-|^confirmed-|^rejected-/.test(item.name))throw new Error('Private cleanup encountered a link or financial ledger; preserved.');
    if(item.isDirectory())inspect(path.join(folder,item.name));
  }}
  inspect(target);io.rmSync(target,{recursive:true,force:false});
}
function validateManifest(manifest,env=process.env,workspace=process.cwd()){
  const expected=`test-results/epp/${String(env.TEST_MARKET||'').toLowerCase()}/s2/${manifest.runId}`;
  if(manifest.market!==env.TEST_MARKET||manifest.environment!=='S2'||String(manifest.buildNumber)!==String(env.BUILD_NUMBER)||manifest.relativeOutput!==expected||!/^[A-Za-z0-9][A-Za-z0-9.-]{0,119}$/.test(manifest.runId||'')||path.resolve(workspace,expected)!==path.resolve(manifest.output||''))throw new Error('EPP current build manifest mismatch.');
  return path.resolve(workspace,expected);
}
function publishInfraFallback(env=process.env){
  const manifest=JSON.parse(fs.readFileSync('test-results/epp-ci-current.json','utf8')),output=validateManifest(manifest,env);
  const model=buildModel({...manifest,document:null,infraError:true});
  const target=path.join(output,'public'),quality=path.join(target,'quality');
  if(fs.existsSync(target))throw new Error('Existing public artifacts preserved; refusing to mix fallback publication.');
  fs.mkdirSync(quality,{recursive:true});
  fs.writeFileSync(path.join(target,'execution.json'),JSON.stringify(publicExecution(manifest)));
  fs.writeFileSync(path.join(quality,'quality.json'),JSON.stringify({...model,reportingFailure:true,rawDiagnostics:'Preserved privately; unavailable in this fallback report.'},null,2));
  fs.writeFileSync(path.join(quality,'index.html'),render(model,{artifactRoot:output}));
  fs.copyFileSync('reporting/executive-v3/dashboard.css',path.join(quality,'dashboard.css'));fs.copyFileSync('reporting/epp-quality/dashboard-theme.css',path.join(quality,'epp-theme.css'));
  for(const directory of ['html','allure-report']){
    fs.mkdirSync(path.join(target,directory),{recursive:true});fs.writeFileSync(path.join(target,directory,'index.html'),'<!doctype html><meta charset="utf-8"><h1>INFRA_ERROR</h1><p>Current execution report unavailable. Raw diagnostics remain private; no historical report substituted.</p>');
  }
  fs.writeFileSync(path.join(target,'publication.json'),JSON.stringify({schemaVersion:1,sanitized:true,infrastructureOnly:true}));
  fs.writeFileSync('test-results/epp-ci-quality-gate.json',JSON.stringify({gate:'INFRA_ERROR',runId:manifest.runId}));
  return model;
}
async function finalize(env=process.env){
  const manifest=JSON.parse(fs.readFileSync('test-results/epp-ci-current.json','utf8')),publicOutput=validateManifest(manifest,env);
  const output=require('../utils/eppCiWorkspace.cjs').validatePrivateOutput(manifest,env);
  let document=null,infraError=false;
  try{document=JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8'));}catch{infraError=true;}
  const preflight=require('../utils/eppCiPreflightResult.cjs').readPreflightResult({...manifest,output});
  const blocked=preflight&&!preflight.ok&&['AUTH_BLOCKED','TEST_DATA_REQUIRED'].includes(preflight.type);
  const orderEvidence=require('../utils/eppCiOrderEvidence.cjs').validateOrderEvidence(manifest,document);
  const model=buildModel({...manifest,document,orderEvidence,preflightType:blocked?preflight.type:undefined,infraError:(infraError&&!blocked)||Boolean(document?.errors?.length)}),quality=path.join(output,'quality');
  fs.mkdirSync(quality,{recursive:true});fs.writeFileSync(path.join(quality,'quality.json'),JSON.stringify(model,null,2));
  fs.writeFileSync(path.join(output,'execution.json'),JSON.stringify(publicExecution(manifest)));
  const renderOptions={artifactRoot:output};
  if(env.BUILD_URL){
    const url=new URL(env.BUILD_URL);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Invalid EPP build report URL.');
    const base=url.href.replace(/\/?$/,'/');renderOptions.artifactBaseUrl=base+'artifact/'+manifest.relativeOutput+'/public/';
    renderOptions.playwrightUrl=base+'02_20_c2b7_20EPP_20Playwright/';renderOptions.allureUrl=base+'03_20_c2b7_20EPP_20Allure/';
  }
  fs.writeFileSync(path.join(quality,'index.html'),render(model,renderOptions));fs.copyFileSync('reporting/executive-v3/dashboard.css',path.join(quality,'dashboard.css'));fs.copyFileSync('reporting/epp-quality/dashboard-theme.css',path.join(quality,'epp-theme.css'));
  fs.writeFileSync('test-results/epp-ci-quality-gate.json',JSON.stringify({gate:model.gate,runId:model.runId,rawExit:Number(env.EPP_RAW_EXIT||1)}));
  const results=path.join(output,'allure'),report=path.join(output,'allure-report');
  if(fs.existsSync(results)&&fs.readdirSync(results).some(n=>n.endsWith('-result.json'))){
    const metadataEnv={...env,TEST_MARKET:model.market,ENVIRONMENT:'S2',TEST_STORE:'EPP',TEST_SUITE:'official-p1',EPP_PROGRAM:model.program,ALLURE_PRESERVE_RAW_STATUS:'1',ALLURE_HISTORY_CACHE_DIR:path.resolve(manifest.authorityRoot,'.ci-allure-history')};
    for(const market of ['MX','PE','CO','CL']){delete metadataEnv[`${market}_QST_ENVIRONMENT`];delete metadataEnv[`${market}_QST_TARGET_IDS`];}
    metadataEnv[`${model.market}_QST_TARGET_IDS`]=env.P1_TARGET_IDS||'';
    const metadata=mode=>{
      const generated=require('node:child_process').spawnSync(process.execPath,['scripts/prepare-allure-ci-metadata.cjs',results,report,mode],{env:metadataEnv,stdio:'inherit',windowsHide:true,timeout:30000});
      if(generated.status!==0)throw new Error('EPP Allure metadata/history generation failed.');
    };
    metadata('prepare');
    const child=require('allure-commandline')(['generate',results,'--clean','-o',report]);
    const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    if(status!==0||!fs.existsSync(path.join(report,'index.html')))throw new Error('EPP Allure generation failed; raw results preserved.');
    metadata('save');
  }else{
    fs.mkdirSync(report,{recursive:true});fs.writeFileSync(path.join(report,'index.html'),'<!doctype html><meta charset="utf-8"><title>EPP Allure unavailable</title><h1>No Allure test execution was recorded</h1><p>Inspect the current quality report and infrastructure diagnostics. No historical execution substituted.</p>');
  }
  if (fs.existsSync(path.join(report,'data','test-cases'))) require('../reporting/epp-quality/allure-theme.cjs').applyAllureTheme(report);
  const redact=require('../reporting/epp-quality/redact.cjs'),values=[];
  for(const name of ['runtime-data.json','ci-card.json']){
    const file=path.resolve('playwright/.auth/epp',name);
    if(fs.existsSync(file))redact.secretValues(JSON.parse(fs.readFileSync(file,'utf8')),values);
  }
  const cfg=require('../config/markets/epp').getEppConfig(model.market,{ENVIRONMENT:'S2',EPP_PROGRAM:model.program});
  if(cfg.verificationCode)values.push(cfg.verificationCode);
  const published=require('../reporting/epp-quality/publish.cjs').publishSafeArtifacts(output,values);
  fs.mkdirSync(publicOutput,{recursive:true});fs.cpSync(published.target,path.join(publicOutput,'public'),{recursive:true});
  console.log(`[epp-ci] reports finalized: ${model.market} ${model.runId} ${model.gate}`);
  return model;
}
if(require.main===module){
  if(process.argv[2]==='--cleanup'){try{cleanupPrivateWorkspace();}catch{console.error('[epp-ci] Private cleanup refused; files preserved.');process.exitCode=1;}}
  else if(process.argv[2]==='--infra-only'){try{publishInfraFallback();}catch{console.error('[epp-ci] Infrastructure fallback could not be published.');process.exitCode=1;}}
  else finalize().catch(()=>{console.error('[epp-ci] Current-build reporting failed; sensitive details suppressed.');process.exitCode=1;});
}
module.exports={validateManifest,finalize,cleanupPrivateWorkspace,publishInfraFallback,publicExecution};
