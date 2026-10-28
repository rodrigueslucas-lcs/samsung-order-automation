const LABELS = {HANDOFF_ENDED:'PREVIOUS HANDOFF ENDED',HEALTHY:'HEALTHY',RECOVERED:'RECOVERED',REFRESHED:'VERIFIED REFRESH',HUMAN_REQUIRED:'HUMAN REQUIRED',WAITING_PRIMARY:'WAITING FIRST',BUSY:'BUSY',UNPROVEN:'UNPROVEN',TRANSIENT_ERROR:'VERIFICATION UNAVAILABLE',FAILED:'FAILED',VERIFYING:'VERIFYING',REFRESHING:'RECOVERING',STALE:'STALE EVIDENCE',NO_DATA:'NO DATA'};
const ISSUE_LABELS = {STOREFRONT_MAINTENANCE:'Staging maintenance blocks verification',STOREFRONT_UNAVAILABLE:'Staging service unavailable',NETWORK_ERROR:'Staging connectivity failed',VERIFICATION_TIMEOUT:'Verification timed out',SIGNED_OUT:'Signed-out session confirmed',STATE_MISSING:'Saved session unavailable',AUTH_NOT_PROVEN:'Authentication not proven',VERIFICATION_FAILED:'Verification could not complete'};
const COLORS = {HEALTHY:'green',REFRESHED:'green',RECOVERED:'orange',HUMAN_REQUIRED:'red',WAITING_PRIMARY:'purple',BUSY:'slate',UNPROVEN:'purple',TRANSIENT_ERROR:'purple',FAILED:'red',VERIFYING:'blue',REFRESHING:'orange',STALE:'amber',NO_DATA:'slate'};
const COUNTRIES={mx:'Mexico',pe:'Peru',co:'Colombia',cl:'Chile'};
function escape(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function time(value, full = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',...(full?{day:'2-digit',month:'2-digit',year:'numeric'}:{}),hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function elapsed(ms) { if (!Number.isFinite(ms)) return 'Not recorded'; if(ms<60000)return (ms/1000).toFixed(1)+'s'; if(ms<3600000)return Math.floor(ms/60000)+'m';return Math.floor(ms/3600000)+'h '+Math.floor(ms%3600000/60000)+'m'; }
const slot = value => value === 'second' ? 'SECOND' : 'FIRST';
function flag(market) {
  const shapes={mx:'<path fill="#17634b" d="M0 0h12v24H0z"/><path fill="#fff" d="M12 0h12v24H12z"/><path fill="#b42f3f" d="M24 0h12v24H24z"/><circle cx="18" cy="12" r="2" fill="#82622b"/>',pe:'<path fill="#bd263d" d="M0 0h36v24H0z"/><path fill="#fff" d="M12 0h12v24H12z"/>',co:'<path fill="#f4ca41" d="M0 0h36v12H0z"/><path fill="#234e99" d="M0 12h36v6H0z"/><path fill="#b92d42" d="M0 18h36v6H0z"/>',cl:'<path fill="#fff" d="M0 0h36v24H0z"/><path fill="#bd3240" d="M0 12h36v12H0z"/><path fill="#234e99" d="M0 0h12v12H0z"/><path fill="#fff" d="m6 2 1.1 2.6 2.8.2-2.1 1.8.7 2.8L6 7.9 3.5 9.4l.7-2.8-2.1-1.8 2.8-.2z"/>'};
  return `<svg class="country-flag" viewBox="0 0 36 24" role="img" aria-label="${escape(COUNTRIES[market]||'Country')}">${shapes[market]||''}</svg>`;
}
const chip = (label,color) => `<span class="chip ${escape(color)}"><span class="status-icon" aria-hidden="true">${({green:'✓',red:'!',amber:'↻',orange:'↗',blue:'●',purple:'?',slate:'–'})[color]||'●'}</span>${escape(label)}</span>`;
const detail=(label,value)=>`<div><dt>${escape(label)}</dt><dd>${value}</dd></div>`;
function eventType(e) {
  if(e.kind==='bundle'||e.kind==='activity')return 'Jenkins';
  if(e.status==='HUMAN_REQUIRED'||e.status==='WAITING_PRIMARY')return 'Human Gate';
  if(e.status==='RECOVERED'||e.status==='HANDOFF_ENDED')return 'Recovery';
  if(e.status==='REFRESHING'||e.status==='REFRESHED')return 'Refresh';
  if(['VERIFYING','HEALTHY','TRANSIENT_ERROR','UNPROVEN','FAILED','STALE'].includes(e.status))return 'Verification';
  return 'Identity status';
}
function render(model,options={}){return require('./view.cjs').view(model,options,{escape,time,elapsed,eventType,flag,chip});}
module.exports={render,escape,time,elapsed,eventType};
