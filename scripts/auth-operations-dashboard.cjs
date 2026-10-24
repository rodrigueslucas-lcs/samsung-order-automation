const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readCycles, dataDirectory, activity: safeActivity } = require('../utils/authOperationsStore.cjs');
const { readScheduler } = require('../utils/authOperationsScheduler.cjs');
const { jenkinsBuildsIdle } = require('../utils/authJenkinsActivity.cjs');
const { publisherEnvironment } = require('../utils/jenkinsPublisherConfig.cjs');
const { buildModel, legacyCycles } = require('../reporting/auth-operations/model.cjs');
const { render } = require('../reporting/auth-operations/render.cjs');
const { writeJsonAtomically } = require('../utils/atomicJson');

function parseArgs(argv) {
  const result = {environment:'S2',sourceRoot:process.cwd(),output:null,refreshUrl:''};
  for (const arg of argv) {
    if(arg.startsWith('--environment=')) result.environment=arg.slice(14).toUpperCase();
    else if(arg.startsWith('--source-root=')) result.sourceRoot=path.resolve(arg.slice(14));
    else if(arg.startsWith('--output=')) result.output=path.resolve(arg.slice(9));
    else if(arg.startsWith('--refresh-url=')) result.refreshUrl=arg.slice(14);
    else throw new Error('Unsupported dashboard argument.');
  }
  if(!['S1','S2'].includes(result.environment)) throw new Error('Dashboard requires S1 or S2.');
  result.output ||= path.resolve('test-results/auth-operations',result.environment.toLowerCase());
  return result;
}
async function atomicText(file,text) {
  const temporary=file+'.tmp-'+crypto.randomUUID();
  try {
    fs.writeFileSync(temporary,text,{encoding:'utf8',mode:0o600});
    for(let attempt=0;;attempt++) {
      try {fs.renameSync(temporary,file);break;}
      catch(error) {if(!['EBUSY','EPERM','EACCES'].includes(error.code)||attempt===6)throw error;await new Promise(resolve=>setTimeout(resolve,25*(2**attempt)));}
    }
  } finally {fs.rmSync(temporary,{force:true});}
}
function readMetadata(file) {
  try {if(fs.statSync(file).size>1048576)return null;return JSON.parse(fs.readFileSync(file,'utf8'));} catch{return null;}
}
async function main({argv=process.argv.slice(2),env=process.env,read=readCycles,scheduler=readScheduler,activity=jenkinsBuildsIdle,now=Date.now,log=console.log}={}) {
  const args=parseArgs(argv), suffix=args.environment.toLowerCase();
  const stored=read({directory:dataDirectory(env),environment:args.environment});
  const root=path.resolve(args.sourceRoot,'test-results');
  const legacy=legacyCycles({
    keepalive:stored.cycles.length?null:readMetadata(path.join(root,'auth-keepalive',`last-cycle-${suffix}.json`)),
    regional:['primary','second'].map(slot=>readMetadata(path.join(root,'auth-refresh',`regional-${suffix}-${slot}-jenkins-summary.json`))),
  });
  // Display navigation is independent of the credential-bearing API origin.
  // A LAN dashboard must not weaken the publisher's HTTPS/loopback policy.
  const localDisplay=readMetadata(path.resolve(args.sourceRoot,'playwright/.auth/jenkins-publisher.local.json'));
  let buildActivity={known:false,active:[],queued:[]},refreshOrigin=env.AUTH_OPERATIONS_REFRESH_ORIGIN||localDisplay?.dashboardOrigin||'';
  try {
    const configured=publisherEnvironment(env,{readFile:()=>fs.readFileSync(path.resolve(args.sourceRoot,'playwright/.auth/jenkins-publisher.local.json'),'utf8')});
    if(!refreshOrigin&&configured.JENKINS_URL)refreshOrigin=new URL(configured.JENKINS_URL).origin;
    buildActivity=safeActivity(await activity(configured));
  } catch { /* Unavailable metadata is displayed as unknown, never as idle. */ }
  const model=buildModel({cycles:[...stored.cycles,...legacy],scheduler:scheduler(args.environment,{env,now:now()}),activity:buildActivity,corrupt:stored.corrupt,environment:args.environment,now:now()});
  const html=render(model,{refreshUrl:args.refreshUrl,refreshOrigin});
  fs.mkdirSync(args.output,{recursive:true});
  await atomicText(path.join(args.output,'styles.css'),fs.readFileSync(path.resolve(__dirname,'../reporting/auth-operations/styles.css'),'utf8'));
  await atomicText(path.join(args.output,'countdown.js'),fs.readFileSync(path.resolve(__dirname,'../reporting/auth-operations/countdown.js'),'utf8'));
  writeJsonAtomically(path.join(args.output,'state.json'),model);
  writeJsonAtomically(path.join(args.output,'metrics.json'),{environment:model.environment,generatedAt:model.generatedAt,metrics:model.metrics});
  writeJsonAtomically(path.join(args.output,'events.json'),{environment:model.environment,generatedAt:model.generatedAt,events:model.timeline});
  await atomicText(path.join(args.output,'index.html'),html);
  log(`[auth:operations] ${args.environment}: six identity cards rendered; scheduler=${model.scheduler.status}; attention=${model.attention.length}. Read-only; no auth operation ran.`);
  return model;
}
if(require.main===module)main().catch(()=>{console.error('[auth:operations] Report unavailable; authentication was not changed.');process.exitCode=1;});
module.exports={main,parseArgs,readMetadata,atomicText};
