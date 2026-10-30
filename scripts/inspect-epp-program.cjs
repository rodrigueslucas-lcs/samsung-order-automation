const fs=require('node:fs');
const path=require('node:path');
const {getEppConfig}=require('../config/markets/epp');
const sessions=require('../utils/eppSession.cjs');
const {inspectProgram}=require('../utils/eppProgramAccess.cjs');
const {writeJsonAtomically}=require('../utils/atomicJson');

async function inspect(market,environment,program,{env=process.env}={}){
  const config=getEppConfig(market,{...env,ENVIRONMENT:environment,[`${market}_QST_ENVIRONMENT`]:environment,EPP_PROGRAM:program,[`${market}_EPP_PROGRAM`]:program});
  market=config.market;environment=config.environment;program=config.program;
  if(config.programPolicy.knownStatus==='BLOCKED_CALLBACK_TO_PRODUCTION')return{market,environment,program,health:'BLOCKED',reason:'BLOCKED_CALLBACK_TO_PRODUCTION',action:'SKIP_KNOWN_BLOCKER',retries:0};
  const lease=sessions.acquireEppLease(config,env);
  try{
    const files=sessions.getEppSessionPaths(config),observation=path.join(files.directory,'program-observation.json');
    if(config.programPolicy.knownStatus==='ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED'&&fs.existsSync(observation)){
      const previous=JSON.parse(fs.readFileSync(observation,'utf8'));
      if(previous.store!=='EPP'||previous.market!==market||previous.environment!==environment||previous.program!==program)throw new Error('Programme observation ownership mismatch.');
      return {...previous,action:'SKIP_ALREADY_INVESTIGATED',retries:0};
    }
    // Same market/environment/slot EPP only; never proof of target entitlement.
    const {snapshot,sourceProgram}=sessions.loadEppProgramSeed(config);
    const result=await inspectProgram(config,snapshot,{expectedEmail:sessions.getPrimaryEppCredentials(config).email});
    const {snapshot:renewed,...publicResult}=result;
    publicResult.identitySeedProgram=sourceProgram;
    fs.mkdirSync(files.directory,{recursive:true});
    if(renewed)sessions.persistVerifiedEppSession(config,renewed);
    writeJsonAtomically(observation,publicResult);
    return publicResult;
  }finally{lease.release();}
}
if(require.main===module)inspect(...process.argv.slice(2,5)).then(r=>console.log(JSON.stringify(r))).catch(error=>{console.error(JSON.stringify({status:error.code==='AUTH_BUSY'?'BUSY':'BLOCKED',reason:error.code==='AUTH_BUSY'?'EPP_IDENTITY_BUSY':'PROGRAM_INSPECTION_UNPROVEN',loginAttempts:0}));process.exitCode=1;});
module.exports={inspect};
