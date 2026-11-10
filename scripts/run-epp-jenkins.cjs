const fs=require('node:fs'),path=require('node:path');
const {buildRun,executeRun,summarizeRun}=require('./run-epp-qst.cjs');
const {getEppConfig}=require('../config/markets/epp');
const {authorityRoot}=require('../utils/eppCiAuthority.cjs');
const {buildModel}=require('../reporting/epp-quality/model.cjs');
const {render}=require('../reporting/epp-quality/render.cjs');
const programmes={MX:'pymesmx',PE:'pe_membership_vip',CL:'alianzas',CO:'co_epp_agre'};
function installRuntime(market,env,io=fs){
  if(!env.EPP_CI_RUNTIME_FILE)return env;
  const policy=JSON.parse(io.readFileSync(env.EPP_CI_RUNTIME_FILE,'utf8'));
  if(policy.market!==market||policy.environment!=='S2'||policy.program!==programmes[market]||policy.hostname!==require('node:os').hostname()||!policy.fixtures||typeof policy.fixtures!=='object'||Array.isArray(policy.fixtures))throw new Error('EPP CI runtime credential scope mismatch.');
  const configured={...env,EPP_CI_AUTHORITY_ROOT:policy.authorityRoot};
  const root=authorityRoot(configured);
  if(!root||!io.existsSync(root))throw new Error('Durable EPP authority unavailable.');
  const directory=path.resolve('playwright/.auth/epp');io.mkdirSync(directory,{recursive:true});
  io.writeFileSync(path.join(directory,'runtime-data.json'),JSON.stringify(policy.fixtures),{mode:0o600});
  if(policy.cardFixture){
    if(!['CL','CO'].includes(market)||typeof policy.cardFixture!=='object'||Array.isArray(policy.cardFixture))throw new Error('Invalid EPP provider fixture scope.');
    const file=path.join(directory,'ci-card.json');io.writeFileSync(file,JSON.stringify(policy.cardFixture),{mode:0o600});
    configured[market==='CL'?'CL_TEST_CARD_FILE':'MX_TEST_CARD_FILE']=file;
  }
  if(policy.reporting){
    if(policy.reporting.publisherConfig!==path.resolve(root,'..','jenkins-publisher.local.json'))throw new Error('Invalid regional summary observer scope.');
    configured.EPP_CI_REPORTING=JSON.stringify(policy.reporting);
  }
  return configured;
}
function runCi(market,source=process.env,{execute=executeRun,io=fs,build=buildRun,summarize=summarizeRun}={}){
  if(!Object.hasOwn(programmes,market)||source.CI!=='1'||source.ENVIRONMENT!=='S2')throw new Error('Invalid EPP CI request.');
  // Trusted job configuration, never operator-provided auth or Production fallback.
  let env={...source,TEST_MARKET:market,TEST_STORE:'EPP',ENVIRONMENT:'S2',EPP_PROGRAM:programmes[market],[`${market}_EPP_PROGRAM`]:programmes[market],[`${market}_QST_ENVIRONMENT`]:'S2',EPP_AUTH_SLOT:'primary',[`${market}_EPP_AUTH_SLOT`]:'primary',EPP_RESUME_PENDING_ORDER:'0',BROWSER_MODE:'headless',ENABLE_ALLURE:'1',ALLURE_DETAIL:'false',EPP_AUTH_PREFLIGHT:'1',EPP_CI_PRIVATE_EVIDENCE:'1'};
  for(const other of Object.keys(programmes))for(const suffix of ['QST_TARGET_IDS','EPP_QST_PDP_URL','EPP_QST_PLP_URL','EPP_QST_SKU'])delete env[`${other}_${suffix}`];
  for(const key of ['EPP_QST_PDP_URL','EPP_QST_PLP_URL','EPP_QST_SKU'])delete env[key];
  delete env.EPP_CI_REPORTING;
  let setupError=false;
  try{env=installRuntime(market,env,io);}catch{setupError=true;}
  let run;
  try{run=build(market,[],env,setupError?{readData:()=>null}:undefined);}catch{setupError=true;run=build(market,[],env,{readData:()=>null});}
  const config=getEppConfig(market,run.env);
  const publicOutput=run.output;
  run.output=require('../utils/eppCiWorkspace.cjs').privateRunDirectory(market,run.env.EPP_RUN_ID,env);
  Object.assign(run.env,{EPP_OUTPUT_DIR:path.join(run.output,'playwright'),PLAYWRIGHT_HTML_OUTPUT_DIR:path.join(run.output,'html'),PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(run.output,'results.json'),ALLURE_RESULTS_DIR:path.join(run.output,'allure'),SMB_EVIDENCE_DIR:path.join(run.output,'evidence')});
  run.env.EPP_CI_PREFLIGHT_FILE=path.join(run.output,'preflight.json');
  const manifest=path.resolve('test-results/epp-ci-current.json');
  io.mkdirSync(path.dirname(manifest),{recursive:true});
  io.writeFileSync(manifest,JSON.stringify({market,environment:'S2',program:config.program,runId:run.env.EPP_RUN_ID,gitCommit:/^[a-f0-9]{40}$/i.test(env.GIT_COMMIT||'')?env.GIT_COMMIT:null,output:publicOutput,privateOutput:run.output,authorityRoot:env.EPP_CI_AUTHORITY_ROOT||null,reporting:env.EPP_CI_REPORTING?JSON.parse(env.EPP_CI_REPORTING):null,relativeOutput:path.relative(process.cwd(),publicOutput).replaceAll('\\','/'),buildNumber:env.BUILD_NUMBER||null}));
  let exit=1,infraError=false;
  try{
    if(setupError)throw new Error('EPP CI runtime setup failed.');
    const authority=authorityRoot(env);
    if(!authority||!io.existsSync(authority))throw new Error('Durable EPP financial authority unavailable; no execution started.');
    const authorityRelative=path.relative(process.cwd(),authority);
    if(!authorityRelative.startsWith('..')&&!path.isAbsolute(authorityRelative))throw new Error('Financial authority must be outside the ephemeral Jenkins workspace.');
    if(!env.EPP_SESSION_BUNDLE_FILE||!io.existsSync(env.EPP_SESSION_BUNDLE_FILE))throw new Error('EPP session credential unavailable; no execution started.');
    exit=execute(run);summarize(run);
  }catch{infraError=true;}
  finally{
    const filename=path.join(run.output,'results.json');
    let document=null;
    try{if(io.existsSync(filename))document=JSON.parse(io.readFileSync(filename,'utf8'));}catch{infraError=true;}
    const preflight=require('../utils/eppCiPreflightResult.cjs').readPreflightResult({market,environment:'S2',program:config.program,runId:run.env.EPP_RUN_ID,output:run.output},io);
    const blocked=preflight&&!preflight.ok&&['AUTH_BLOCKED','TEST_DATA_REQUIRED'].includes(preflight.type);
    const model=buildModel({market,environment:'S2',program:config.program,runId:run.env.EPP_RUN_ID,buildNumber:env.BUILD_NUMBER,document,preflightType:blocked?preflight.type:undefined,infraError:infraError||(!document&&!blocked)});
    const directory=path.join(run.output,'quality');io.mkdirSync(directory,{recursive:true});
    io.writeFileSync(path.join(directory,'quality.json'),JSON.stringify(model,null,2));
    io.writeFileSync(path.join(directory,'index.html'),render(model,{artifactRoot:run.output}));
    io.copyFileSync(path.resolve('reporting/executive-v3/dashboard.css'),path.join(directory,'dashboard.css'));
    io.writeFileSync(path.resolve('test-results/epp-ci-quality-gate.json'),JSON.stringify({gate:model.gate,rawExit:exit,runId:model.runId}));
    console.log(`[epp-ci] ${market} raw suite complete; passed ${model.counts.PASS}/${model.official}; raw exit ${exit}; final quality gate awaits order/report validation`);
  }
  return exit;
}
if(require.main===module){try{process.exitCode=runCi(process.argv[2]);}catch{console.error('[epp-ci] Preflight/configuration/reporting error; sensitive details suppressed.');process.exitCode=1;}}
module.exports={runCi,programmes,installRuntime};
