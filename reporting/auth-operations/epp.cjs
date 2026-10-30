const {getEppConfig,getEppPrograms}=require('../../config/markets/epp');
const MARKETS=['MX','PE','CO','CL'];
const STATES=new Set(['KEEP_ALIVE_OK','REFRESHED','HUMAN_REQUIRED','BLOCKED','BUSY','UNPROVEN','PUBLISH_FAILED']);
function eppView(summary,environment,now=Date.now(),metadata={},maintenance={},observations={}){
  const stamp=Date.parse(summary?.generatedAt),valid=summary?.store==='EPP'&&summary.environment===environment&&Number.isFinite(stamp)&&stamp<=now+60000;
  const fresh=valid&&now-stamp<=1800000;
  return{generatedAt:valid?new Date(stamp).toISOString():null,sessions:MARKETS.flatMap(market=>getEppPrograms(market,environment).map(policy=>{
    const config=getEppConfig(market,{ENVIRONMENT:environment,EPP_PROGRAM:policy.id}),program=config.program,key=market+':'+program;
    const observation=observations[key],observedTime=Date.parse(observation?.observedAt);
    const programObserved=observation?.store==='EPP'&&observation.market===market&&observation.environment===environment&&observation.program===program&&observation.slot==='primary'&&(observation.root===config.rootUrl.href||(!observation.root&&!policy.reportedEntryUrl))&&Number.isFinite(observedTime)&&observedTime<=now+60000;
    const matches=valid&&Array.isArray(summary.identities)?summary.identities.filter(r=>r.market===market&&r.environment===environment&&r.slot==='primary'&&(r.program===program||r.program===config.rootUrl.pathname||(!r.program&&policy.legacy))):[];
    const row=matches.length===1?matches[0]:null,proven=row?.proof?.userAccepted===true&&row?.proof?.accessAccepted===true;
    const pending=maintenance[key]||(policy.legacy?maintenance[market]:null),pendingTime=Date.parse(pending?.observedAt);
    const human=pending?.human===true&&!pending.blockedReason&&Number.isFinite(pendingTime)&&pendingTime<=now+60000;
    const status=human?'HUMAN_REQUIRED':row&&STATES.has(row.status)?row.status:'NO_DATA';
    const identity=metadata[key]||(policy.legacy?metadata[market]:null),time=Date.parse(identity?.verifiedAt);
    const previous=identity?.store==='EPP'&&identity.market===market&&identity.environment===environment&&identity.root===config.rootUrl.href&&(identity.authSlot||'primary')==='primary'&&identity.verified===true&&identity.serverAccepted===true&&Number.isFinite(time)&&time<=now?new Date(time).toISOString():null;
    const lastVerified=proven&&['KEEP_ALIVE_OK','REFRESHED'].includes(status)?new Date(stamp).toISOString():previous;
    const reason=human?'SAMSUNG_VERIFICATION_REQUIRED':/^[A-Z_0-9]{1,100}$/.test(row?.reason||'')?row.reason:null;
    const health=status==='HUMAN_REQUIRED'?'HUMAN_REQUIRED':status==='BLOCKED'||status==='PUBLISH_FAILED'?'BLOCKED':fresh&&proven&&['KEEP_ALIVE_OK','REFRESHED'].includes(status)?'HEALTHY':'STALE';
    const result={market:market.toLowerCase(),environment,program,slot:'primary',observed:!!row||human,health,status,operation:'IDLE',reason,at:human?new Date(pendingTime).toISOString():row?new Date(stamp).toISOString():null,lastVerified,verifiedAgeMs:lastVerified?now-Date.parse(lastVerified):null,identity:row?.proof?.userAccepted===true?'AUTHENTICATED':'UNKNOWN',entitlement:proven?'VALID':'UNKNOWN',storefront:reason==='EPP_COMMERCE_NOT_RENDERED'?'BLOCKED':health==='HEALTHY'?'AUTH UI VERIFIED':'UNKNOWN',published:row?.published===true,source:row?.blockerSource==='CHECKPOINT'?'PREVIOUSLY CONFIRMED':row?'CURRENT CHECK':'NO CURRENT CHECK',callbackBehavior:policy.callbackBehavior};
    if(programObserved&&(!row||observedTime>=stamp)){
      const accepted=observation.proof?.userAccepted===true&&observation.proof?.accessAccepted===true&&observation.storefront==='OK';
      result.identity=observation.proof?.userAccepted===true?'AUTHENTICATED':'UNKNOWN';result.entitlement=observation.proof?.accessAccepted===true?'VALID':'UNKNOWN';
      result.storefront=['OK','EMPTY','BLOCKED'].includes(observation.storefront)?observation.storefront:'UNKNOWN';
      result.health=accepted?(now-observedTime<=1800000?'HEALTHY':'STALE'):'BLOCKED';
      result.status=accepted?'KEEP_ALIVE_OK':'BLOCKED';
      result.reason=/^[A-Z_0-9]{1,100}$/.test(observation.reason||'')?observation.reason:null;
      result.source='PROGRAM INSPECTION';result.observed=true;result.at=new Date(observedTime).toISOString();
      if(accepted){result.lastVerified=result.at;result.verifiedAgeMs=now-observedTime;}
      if(observation.callbackStatus==='BROKEN_400')result.callbackBehavior='CALLBACK_BROKEN_400 / RECOVERABLE';
    }else if(!row&&!human&&policy.allowAutomaticRetry===false){result.reason=policy.knownStatus;result.health='BLOCKED';result.source='OPERATOR OBSERVATION';}
    return result;
  }))};
}
module.exports={eppView};
