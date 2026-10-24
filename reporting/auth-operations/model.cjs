const { SLOTS, cleanCycle } = require('../../utils/authOperationsStore.cjs');
const { safeTime } = require('../../utils/authOperationsScheduler.cjs');
const SUCCESS = new Set(['HEALTHY', 'RECOVERED', 'REFRESHED']);
const VERIFY_OUTCOMES = new Set(['HEALTHY','NEEDS_REFRESH','TRANSIENT_ERROR','UNPROVEN','RECOVERED']);
function legacyCycles({ keepalive, regional = [] } = {}) {
  const result = [];
  if (safeTime(keepalive?.generatedAt)) {
    const cycle = cleanCycle({ schemaVersion:1, origin:'LEGACY_HEALTH', environment:keepalive.environment, startedAt:keepalive.generatedAt, finishedAt:keepalive.generatedAt, state:'COMPLETE', identities:keepalive.identities, finalized:keepalive.finalized, events:[] });
    if (cycle) result.push(cycle);
  }
  for (const summary of regional) {
    if (!safeTime(summary?.generatedAt) || !['S1','S2'].includes(summary.environment)) continue;
    const identities = (Array.isArray(summary.results)?summary.results:[]).filter(row => row?.status === 'READY' && Object.hasOwn(SLOTS,row.market) && SLOTS[row.market].includes(row.slot)).map(row => ({market:row.market, slot:row.slot, status:'REFRESHED', refreshDurationMs:row.elapsedMs}));
    const events = identities.map(row => ({kind:'identity',at:summary.generatedAt,...row}));
    const finalized = summary.publishJenkins===true ? [...new Set(identities.map(row=>row.market))].map(market=>({market,status:'READY',published:true,synchronized:true})) : [];
    const cycle = cleanCycle({schemaVersion:1,origin:'MANUAL_REFRESH',environment:summary.environment,startedAt:summary.generatedAt,finishedAt:summary.generatedAt,state:'COMPLETE',identities,finalized,events});
    if (cycle) result.push(cycle);
  }
  return result;
}
function buildModel({ cycles = [], scheduler, activity, corrupt = 0, environment = 'S2', now = Date.now() } = {}) {
  const history = cycles.map(row=>{try{return cleanCycle(row);}catch{return null;}}).filter(row => row?.environment === environment && Date.parse(row.startedAt)<=now+60000).sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt));
  const events = history.flatMap(cycle => {
    const entries = [...cycle.events];
    for (const row of cycle.identities) if (!entries.some(e=>e.kind==='identity'&&e.market===row.market&&e.slot===row.slot&&e.status===row.status)) entries.push({kind:'identity',at:cycle.finishedAt||cycle.startedAt,...row});
    for (const row of cycle.finalized) if (!entries.some(e=>e.kind==='bundle'&&e.market===row.market)) entries.push({kind:'bundle',at:cycle.finishedAt||cycle.startedAt,...row});
    return entries;
  }).filter(e=>Date.parse(e.at)<=now+60000).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const freshnessMs = (scheduler?.intervalMinutes || 15) * 2 * 60000;
  const sessions = Object.entries(SLOTS).flatMap(([market,slots])=>slots.map(slot=>{
    const own = events.filter(e=>e.kind==='identity'&&e.market===market&&e.slot===slot);
    const latest = own.at(-1), verified = own.filter(e=>SUCCESS.has(e.status)).at(-1);
    const refreshed = own.filter(e=>['RECOVERED','REFRESHED'].includes(e.status)).at(-1);
    const human = own.filter(e=>e.status==='HUMAN_REQUIRED').at(-1);
    const bundle = events.filter(e=>e.kind==='bundle'&&e.market===market).at(-1);
    const stale = Boolean(latest && SUCCESS.has(latest.status) && now-Date.parse(latest.at)>freshnessMs);
    const boundary=own.filter(e=>SUCCESS.has(e.status)||e.status==='HANDOFF_ENDED').at(-1);
    const unresolvedHuman=human&&(!boundary||own.indexOf(human)>own.indexOf(boundary));
    return {
      market,slot,status:unresolvedHuman?'HUMAN_REQUIRED':stale?'STALE':latest?.status||'NO_DATA',at:unresolvedHuman?human.at:latest?.at||null,lastOutcome:latest?.status||'NO_DATA',
      lastVerify:verified?.at||null,lastRefresh:refreshed?.at||null,lastHuman:human?.at||null,
      verifyDurationMs:[...own].reverse().find(e=>e.verifyDurationMs!==undefined)?.verifyDurationMs??null,
      refreshDurationMs:[...own].reverse().find(e=>e.refreshDurationMs!==undefined)?.refreshDurationMs??null,
      retries:own.filter(e=>VERIFY_OUTCOMES.has(e.status)&&(e.attempts||0)>1).length,bundle:typeof bundle?.changed==='boolean'?(bundle.changed?'CHANGED':'SAME'):'UNKNOWN',
      jenkins:bundle?.status==='READY'?(bundle.published?'UPDATED':bundle.synchronized===true?'SYNCED':'NOT_CONFIRMED'):bundle?.status||'UNKNOWN',
      ageMs:refreshed?Math.max(0,now-Date.parse(refreshed.at)):null,
      isolation:'NOT_RECORDED',
    };
  }));
  const day = value => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const today = events.filter(e=>day(e.at)===day(now));
  const pendingGates=new Set();let humanToday=0;
  for(const event of events.filter(e=>e.kind==='identity')) {
    const key=event.market+':'+event.slot;
    if(event.status==='HUMAN_REQUIRED') {
      if(!pendingGates.has(key)&&day(event.at)===day(now))humanToday++;
      pendingGates.add(key);
    } else if(SUCCESS.has(event.status)||event.status==='HANDOFF_ENDED')pendingGates.delete(key);
  }
  const samples=history.filter(c=>c.state==='COMPLETE'&&day(c.finishedAt||c.startedAt)===day(now)).flatMap(c=>c.identities);
  const measured = samples.filter(e=>['HEALTHY','RECOVERED','TRANSIENT_ERROR','UNPROVEN','FAILED','HUMAN_REQUIRED','WAITING_PRIMARY','NEEDS_REFRESH'].includes(e.status));
  const average = key => {const values=samples.filter(e=>Number.isFinite(e[key])).map(e=>e[key]);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
  return {
    environment,generatedAt:new Date(now).toISOString(),scheduler:scheduler||{status:'UNKNOWN'},activity:activity||{known:false,active:[],queued:[]},sessions,
    attention:sessions.filter(s=>s.status==='HUMAN_REQUIRED'),lastCheck:history.map(c=>c.finishedAt||c.events.at(-1)?.at||c.startedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null,
    timeline:events.slice(-60).reverse(),corrupt,
    metrics:{healthy:sessions.filter(s=>SUCCESS.has(s.status)).length,total:6,cycles:history.filter(c=>c.origin!=='MANUAL_REFRESH').length,
      healthyCycles:history.filter(c=>c.state==='COMPLETE'&&c.identities.length===6&&c.identities.every(i=>SUCCESS.has(i.status))).length,
      retries:today.filter(e=>e.kind==='identity'&&VERIFY_OUTCOMES.has(e.status)&&(e.attempts||0)>1).length,
      recoveries:today.filter(e=>e.status==='RECOVERED').length,human:humanToday,
      busyCycles:history.filter(c=>c.state==='BUSY'||c.identities.some(i=>i.status==='BUSY')).length,
      published:today.filter(e=>e.kind==='bundle'&&e.published).length,
      availability:measured.length?100*measured.filter(e=>SUCCESS.has(e.status)).length/measured.length:null,
      averageVerifyMs:average('verifyDurationMs'),averageRefreshMs:average('refreshDurationMs'),
      lastIncident:events.filter(e=>e.kind==='identity'&&!SUCCESS.has(e.status)&&!['VERIFYING','REFRESHING'].includes(e.status)).at(-1)?.at||null,
      lastHuman:events.filter(e=>e.status==='HUMAN_REQUIRED').at(-1)?.at||null,
    },
  };
}
module.exports = { buildModel, legacyCycles };
