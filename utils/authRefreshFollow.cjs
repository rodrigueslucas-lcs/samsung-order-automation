const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {leaseDirectory}=require('./authMarketLease.cjs');
const {dataDirectory,cleanCycle}=require('./authOperationsStore.cjs');

// Follow only a running cycle correlated with a live, local market lease.
// This observer never takes a lease, opens a browser or restarts a login.
function activeRecovery(market,environment,env=process.env){
 const ownerFile=path.join(leaseDirectory(env),`${environment.toLowerCase()}-${market}.lock`,'owner.json');
 let owner,written;
 try{owner=JSON.parse(fs.readFileSync(ownerFile,'utf8'));written=fs.statSync(ownerFile).mtimeMs;if(owner.hostname!==os.hostname()||!Number.isInteger(owner.pid)||owner.pid<=0)return null;process.kill(owner.pid,0);}catch{return null;}
 const directory=dataDirectory(env);
 let names;try{names=fs.readdirSync(directory).filter(n=>/^cycle-\d{13}-[a-f0-9-]{36}\.json$/.test(n)).sort().reverse();}catch{return null;}
 for(const name of names){
  const start=Number(name.slice(6,19));
  if(Math.abs(written-start)>5400000)continue;
  const file=path.join(directory,name);
  const read=()=>{try{return cleanCycle(JSON.parse(fs.readFileSync(file,'utf8')));}catch{return null;}};
  const cycle=read();
  if(cycle?.ownerPid?cycle.ownerPid!==owner.pid:Math.abs(written-start)>120000)continue;
  if(cycle?.environment!==environment||cycle.origin!=='KEEPALIVE'||cycle.state!=='RUNNING'||!cycle.identities.some(i=>i.market===market))continue;
  return{read,startedAt:cycle.startedAt};
 }
 return null;
}

async function followActiveRecovery(market,environment,slot,env=process.env,{find=activeRecovery,now=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 const tracked=find(market,environment,env);if(!tracked)return null;
 const started=now(),limit=Math.min(1800000,Math.max(1000,Number(env.AUTH_REFRESH_FOLLOW_TIMEOUT_MS)||1500000));
 let last='',human=false;
 log(`[${market.toUpperCase()}] FOLLOWING existing keep-alive recovery; no duplicate login will start.`);
 while(now()-started<limit){
  const cycle=tracked.read();if(!cycle||cycle.startedAt!==tracked.startedAt)return null;
  const identity=cycle.identities.find(i=>i.market===market&&i.slot===slot);
  const primaryPending=slot==='second'&&cycle.identities.some(i=>i.slot==='primary'&&(i.status==='HUMAN_REQUIRED'||i.status==='REFRESHING'||i.status==='NEEDS_REFRESH'));
  const phase=primaryPending?'WAITING_FIRST':identity?.status||'WAITING_EXISTING_CYCLE';
  human=phase==='HUMAN_REQUIRED'||primaryPending&&cycle.identities.some(i=>i.slot==='primary'&&i.status==='HUMAN_REQUIRED');
  if(phase!==last){last=phase;log(`[${market.toUpperCase()}] ${slot.toUpperCase()} ${phase}${phase==='WAITING_FIRST'?' · complete the existing FIRST windows; SECOND remains queued.':phase==='HUMAN_REQUIRED'?' · complete the existing dedicated window.':''}`);}
  const bundle=cycle.finalized.find(b=>b.market===market);
  if(['HEALTHY','RECOVERED'].includes(identity?.status)&&bundle?.status==='READY'&&(env.JENKINS_AUTH_PUBLISH!=='1'||bundle.synchronized===true))return{market,environment,slot,status:'READY',code:0,signal:null,elapsedMs:now()-started,followedExisting:true};
  if(cycle.state!=='RUNNING')return{market,environment,slot,status:human?'HUMAN_REQUIRED':'FAILED',code:human?2:1,signal:null,elapsedMs:now()-started,followedExisting:true};
  await pause(3000);
 }
 return{market,environment,slot,status:human?'HUMAN_REQUIRED':'BUSY',code:human?2:3,signal:null,elapsedMs:now()-started,followedExisting:true};
}
module.exports={activeRecovery,followActiveRecovery};
