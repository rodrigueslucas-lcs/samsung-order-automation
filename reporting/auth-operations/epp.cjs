const {getEppConfig}=require('../../config/markets/epp');
const MARKETS=['MX','PE','CO','CL'];
const STATES=new Set(['KEEP_ALIVE_OK','REFRESHED','HUMAN_REQUIRED','BLOCKED','BUSY','UNPROVEN','PUBLISH_FAILED']);
function eppView(summary,environment,now=Date.now(),metadata={},maintenance={}){
  const stamp=Date.parse(summary?.generatedAt),valid=summary?.store==='EPP'&&summary.environment===environment&&Number.isFinite(stamp)&&stamp<=now+60000;
  const fresh=valid&&now-stamp<=1800000;
  return{generatedAt:valid?new Date(stamp).toISOString():null,sessions:MARKETS.map(market=>{
    const config=getEppConfig(market,{ENVIRONMENT:environment}),program=config.rootUrl.pathname.split('/')[3];
    const matches=valid&&Array.isArray(summary.identities)?summary.identities.filter(r=>r.market===market&&r.environment===environment&&r.slot==='primary'):[];
    const row=matches.length===1?matches[0]:null,proven=row?.proof?.userAccepted===true&&row?.proof?.accessAccepted===true;
    const pending=maintenance[market],pendingTime=Date.parse(pending?.observedAt);
    const human=pending?.human===true&&!pending.blockedReason&&Number.isFinite(pendingTime)&&pendingTime<=now+60000;
    const status=human?'HUMAN_REQUIRED':row&&STATES.has(row.status)?row.status:'NO_DATA';
    const identity=metadata[market],time=Date.parse(identity?.verifiedAt);
    const previous=identity?.store==='EPP'&&identity.market===market&&identity.environment===environment&&identity.root===config.rootUrl.href&&(identity.authSlot||'primary')==='primary'&&identity.verified===true&&identity.serverAccepted===true&&Number.isFinite(time)&&time<=now?new Date(time).toISOString():null;
    const lastVerified=proven&&['KEEP_ALIVE_OK','REFRESHED'].includes(status)?new Date(stamp).toISOString():previous;
    const reason=human?'SAMSUNG_VERIFICATION_REQUIRED':/^[A-Z_0-9]{1,100}$/.test(row?.reason||'')?row.reason:null;
    const health=status==='HUMAN_REQUIRED'?'HUMAN_REQUIRED':status==='BLOCKED'||status==='PUBLISH_FAILED'?'BLOCKED':fresh&&proven&&['KEEP_ALIVE_OK','REFRESHED'].includes(status)?'HEALTHY':'STALE';
    return{market:market.toLowerCase(),environment,program,slot:'primary',observed:!!row||human,health,status,operation:'IDLE',reason,at:human?new Date(pendingTime).toISOString():valid?new Date(stamp).toISOString():null,lastVerified,verifiedAgeMs:lastVerified?now-Date.parse(lastVerified):null,identity:row?.proof?.userAccepted===true?'AUTHENTICATED':'UNKNOWN',entitlement:proven?'VALID':'UNKNOWN',storefront:reason==='EPP_COMMERCE_NOT_RENDERED'?'BLOCKED':health==='HEALTHY'?'AUTH UI VERIFIED':'UNKNOWN',published:row?.published===true,source:row?.blockerSource==='CHECKPOINT'?'PREVIOUSLY CONFIRMED':'CURRENT CHECK'};
  })};
}
module.exports={eppView};
