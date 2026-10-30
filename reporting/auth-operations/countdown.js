/* Presentation only: no requests, storage, auth operations or schedule changes. */
(function(root){
  const V3_STYLES=`
    .ready-chip{box-shadow:inset 0 0 0 1px #0b7a5b14;font-weight:800}
    .summary-counts{gap:10px!important;margin-top:18px!important}
    .summary-counts>div{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin:0!important;padding:11px 12px;border:1px solid #dfe6f0;border-radius:10px;background:#fff;min-height:54px}
    .summary-counts dt{font-size:10px;font-weight:800;letter-spacing:.55px;color:#52647c}
    .summary-counts dd{font-size:18px!important;font-weight:800!important;color:#243957}
    .summary-counts>div[data-state="healthy"]{background:#edf8f3;border-color:#c6e6d7}.summary-counts>div[data-state="healthy"] dt,.summary-counts>div[data-state="healthy"] dd{color:#087456}
    .summary-counts>div[data-state="stale"]{background:#fff9e9;border-color:#ead9a9}.summary-counts>div[data-state="stale"] dt,.summary-counts>div[data-state="stale"] dd{color:#8a5a09}
    .summary-counts>div[data-state="blocked"]{background:#fff1f4;border-color:#efc7d0}.summary-counts>div[data-state="blocked"] dt,.summary-counts>div[data-state="blocked"] dd{color:#ab2840}
    .summary-counts>div[data-state="action-required"]{background:#fff4e8;border-color:#efd1b6}.summary-counts>div[data-state="action-required"] dt,.summary-counts>div[data-state="action-required"] dd{color:#a04e0d}
    .summary-counts>div[data-state="expired"]{background:#f7f8fa}.summary-counts>div[data-state="recoverable"]{background:#f4f1fb;border-color:#dfd2ef}.summary-counts>div[data-state="recoverable"] dt,.summary-counts>div[data-state="recoverable"] dd{color:#7046a3}.summary-counts>div[data-state="entitlement-unknown"]{background:#f6f8fb}
    .health-kpi{padding:23px!important}.health-kpi>p{font-size:11px!important;letter-spacing:1px}.health-kpi>strong{font-size:40px!important}.health-kpi progress{height:8px!important;margin-top:17px!important}
    .action-kpi{position:relative;overflow:hidden;border-color:#efd1b6!important;background:linear-gradient(145deg,#fff,#fff8ef)!important;padding:23px!important}.action-kpi:before{content:'!';position:absolute;right:22px;top:19px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff0df;color:#a04e0d;font-size:19px;font-weight:900}.action-kpi>p{color:#8d4a12!important;font-size:11px!important}.action-kpi>strong{color:#a04e0d;font-size:40px!important}.action-kpi>small{font-size:12px!important;color:#53627a!important;margin-top:4px!important}.compact-actions{margin:16px 0!important}.compact-actions li{position:relative;padding:10px 10px 10px 28px!important;border:1px solid #efd9bd!important;background:#fff;border-radius:9px;margin:8px 0;font-size:11px!important;font-weight:650;color:#344860!important}.compact-actions li:before{content:'!';position:absolute;left:10px;top:10px;color:#a04e0d;font-weight:900}.action-kpi dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:18px!important;border-top:1px solid #efd9bd;padding-top:15px}.action-kpi dl>div{display:block!important;margin:0!important;padding:10px 11px;background:#fff;border:1px solid #e8edf4;border-radius:9px}.action-kpi dt{font-size:9px!important;text-transform:uppercase;letter-spacing:.55px;font-weight:750}.action-kpi dd{text-align:left!important;font-size:17px!important;margin-top:3px!important;color:#213954}
    .dashboard-section[aria-label="Human Action Required"]{border-color:#efd1b6!important;background:linear-gradient(180deg,#fff,#fffaf4)!important;box-shadow:0 8px 24px #a04e0d0b}.dashboard-section[aria-label="Human Action Required"]>h2{display:flex;align-items:center;gap:10px;font-size:24px}.dashboard-section[aria-label="Human Action Required"]>h2:before{content:'!';width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:#d87520;color:white;font-size:16px;font-weight:900}.manual-heading{display:inline-block;padding:5px 9px;border-radius:20px;background:#fff1e5!important;border:1px solid #efd1b6!important;color:#a04e0d!important;letter-spacing:.7px}
    .human-actions{gap:16px!important}.action-item{position:relative;padding:19px 20px!important;background:linear-gradient(145deg,#fff,#fff9f1)!important;border:1px solid #edd6b8!important;border-left:4px solid #d17a20!important;border-radius:12px!important;box-shadow:0 4px 14px #5b3b1208}.action-item>b{display:block;font-size:14px;color:#1e3552;margin-bottom:12px}.action-item p{margin:11px 0!important}.action-item small{display:block;padding-top:9px;border-top:1px solid #eee5d7;font-size:10px!important;line-height:1.6}.action-reason-label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.75px;color:#8b6d44;font-weight:800;margin-bottom:3px}.action-reason{display:block;font-size:16px;color:#a04e0d;line-height:1.25}.action-next{display:block;font-size:13px;color:#243957;line-height:1.4}.action-item p:nth-of-type(3){background:#f7f9fc;padding:10px 12px;border-radius:8px}
    .scheduler-status-strip .chip.green{box-shadow:0 0 0 1px #85d2b522}.identity-table .chip.green.ready-chip{font-size:10px;background:#e8f7f0;border-color:#bfe4d2;color:#087456}.identity-table .chip.green.ready-chip .status-icon{color:#0d936d}
    .hero-meta>span{padding:7px 10px;border:1px solid #ffffff1f;border-radius:8px;background:#ffffff08}.hero-meta .countdown{margin-left:0;border-left:0;padding-left:10px;color:#dce9fc}.hero-meta>span:last-child{color:#d7e6f9}
    section.dashboard-section:has(>.scheduler-grid){padding:26px!important;border:1px solid #d8e2ef;border-radius:14px;background:linear-gradient(180deg,#f9fbfe,#f4f7fb);box-shadow:0 5px 18px #183a6508}
    section.dashboard-section:has(>.scheduler-grid)>h2{font-size:24px;margin-bottom:18px;display:flex;align-items:center;gap:10px}
    section.dashboard-section:has(>.scheduler-grid)>h2:before{content:'↻';display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#eaf1fb;color:#245ab5;font-size:17px;font-weight:800}
    .scheduler-grid{gap:18px!important}.scheduler-grid>.panel{padding:22px!important;border-radius:12px!important;border:1px solid #dbe4ef!important;border-top:4px solid #7b8ca5!important;box-shadow:0 5px 16px #17385e0a!important}.scheduler-grid>.panel:has(.chip.green){border-top-color:#087456!important}.scheduler-grid>.panel:has(.chip.blue){border-top-color:#245ab5!important}.scheduler-grid>.panel:has(.chip.red){border-top-color:#ab2840!important}
    .scheduler-grid h3{font-size:16px!important;color:#1e3552;margin-bottom:16px!important}.scheduler-grid dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.scheduler-grid dl>div{display:block!important;margin:0!important;padding:11px 12px;border:1px solid #e2e8f1;border-radius:9px;background:#fff}.scheduler-grid dt{font-size:9px;text-transform:uppercase;letter-spacing:.6px;font-weight:800;color:#687b94}.scheduler-grid dd{text-align:left!important;margin-top:5px!important;font-size:13px!important;color:#233a57}.scheduler-grid dl>div:nth-child(2){grid-column:1/-1;background:#f7f9fc}.scheduler-grid dl>div:nth-child(2) dd{font-size:15px!important}.scheduler-grid dl>div:nth-child(3),.scheduler-grid dl>div:nth-child(4){background:#f8fbff}.scheduler-grid dl>div:nth-child(3) dd,.scheduler-grid dl>div:nth-child(4) dd{font-size:21px!important;font-weight:800;color:#1f426d}.scheduler-grid dl>div:nth-child(1),.scheduler-grid dl>div:nth-child(5),.scheduler-grid dl>div:nth-child(6){background:#fbfcfe}.scheduler-grid dl>div:nth-child(1) dd,.scheduler-grid dl>div:nth-child(5) dd,.scheduler-grid dl>div:nth-child(6) dd{font-size:12px!important;color:#53627a}
    section.dashboard-section:has(>.scheduler-grid)>.hint{margin-top:14px;padding:10px 12px;border-radius:8px;background:#eef3f9;color:#5f6e85}
    @media(max-width:800px){.action-kpi dl{grid-template-columns:1fr 1fr}.summary-counts{grid-template-columns:1fr!important}.scheduler-grid dl{grid-template-columns:1fr}.scheduler-grid dl>div:nth-child(2){grid-column:auto}}
    @media(max-width:560px){.action-kpi dl{grid-template-columns:1fr}.health-kpi>strong,.action-kpi>strong{font-size:34px!important}.hero-meta>span{width:auto}}
  `;
  function countdown(target,now){
    if(!Number.isFinite(target)||!Number.isFinite(now))return 'Next check unavailable';
    const seconds=Math.ceil((target-now)/1000);
    if(seconds<=0)return 'Scheduled check due · awaiting update';
    return 'Next check in '+Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';
  }
  function freshness(value,now){
    const generated=Date.parse(value);
    if(!Number.isFinite(generated))return 'Data timestamp unavailable';
    const seconds=Math.max(0,Math.floor((now-generated)/1000));
    return seconds<60?'Data updated '+seconds+'s ago':'Data updated '+Math.floor(seconds/60)+'m ago';
  }
  function humanizeStatus(value){
    return ({VERIFYING:'CHECKING',IDLE:'READY',KEEP_ALIVE_OK:'HEALTHY',PUBLISHING:'UPDATING'})[value]||value.replaceAll('_',' ');
  }
  function injectV3Styles(document){
    if(document.getElementById('auth-dashboard-v3'))return;
    const style=document.createElement('style');
    style.id='auth-dashboard-v3';
    style.textContent=V3_STYLES;
    document.head.appendChild(style);
  }
  function polishStatusChips(document){
    [...document.querySelectorAll('.chip')].forEach(node=>{
      const raw=node.textContent.trim().toUpperCase();
      const label=humanizeStatus(raw);
      if(label!==raw)node.childNodes[node.childNodes.length-1].textContent=label;
      if(label==='READY'){
        node.classList.remove('slate','blue');
        node.classList.add('green','ready-chip');
      } else if(label==='CHECKING'||label==='UPDATING'){
        node.classList.remove('slate');
        node.classList.add('blue');
      } else if(raw==='KEEP_ALIVE_OK'){
        node.classList.remove('slate','blue');
        node.classList.add('green');
      }
    });
  }
  function polishSummary(document){
    [...document.querySelectorAll('.summary-counts>div')].forEach(item=>{
      const label=item.querySelector('dt')?.textContent.trim()||'';
      item.dataset.state=label.toLowerCase().replaceAll(' ','-');
    });
    const actionKpi=[...document.querySelectorAll('.executive-grid>.kpi')].find(node=>!node.classList.contains('health-kpi'));
    actionKpi?.classList.add('action-kpi');
    [...document.querySelectorAll('.compact-actions li')].forEach(item=>{item.textContent=item.textContent.replaceAll('_',' ');});
  }
  function polishHumanActions(document){
    const reasonLabels={
      VERIFICATION_CODE_REJECTED:'Verification code rejected',
      CORPORATE_ACTIVATION_REQUIRED:'Corporate activation required',
      SAMSUNG_VERIFICATION_REQUIRED:'Samsung verification required'
    };
    [...document.querySelectorAll('.action-item')].forEach(item=>{
      const reason=[...item.querySelectorAll('p')].find(node=>node.textContent.startsWith('Reason:'));
      if(reason){
        const raw=reason.textContent.slice(7).trim();
        const label=reasonLabels[raw]||raw.replaceAll('_',' ');
        reason.innerHTML='<span class="action-reason-label">Reason</span><strong class="action-reason">'+label+'</strong>';
      }
      const userAction=[...item.querySelectorAll('p')].find(node=>node.textContent.startsWith('User action:'));
      if(userAction){
        const value=userAction.textContent.slice(12).trim();
        userAction.innerHTML='<span class="action-reason-label">Action</span><strong class="action-next">'+value+'</strong>';
      }
    });
  }
  function moveSchedule(document){
    const human=document.querySelector('section.dashboard-section[aria-label="Human Action Required"]');
    const schedule=[...document.querySelectorAll('section.dashboard-section')].find(section=>section.querySelector(':scope > .scheduler-grid'));
    if(human&&schedule&&human.nextElementSibling!==schedule)human.after(schedule);
  }
  if(typeof module==='object'&&module.exports)module.exports={countdown,freshness,humanizeStatus};
  if(!root.document)return;
  injectV3Styles(root.document);
  const nodes=[...root.document.querySelectorAll('[data-next-check]')];
  const stamps=[...root.document.querySelectorAll('[data-generated-at]')];
  const update=()=>{nodes.forEach(node=>{node.textContent=countdown(Number(node.dataset.nextCheck),Date.now());});stamps.forEach(node=>{node.textContent=freshness(node.dataset.generatedAt,Date.now());});};
  polishStatusChips(root.document);
  polishSummary(root.document);
  polishHumanActions(root.document);
  moveSchedule(root.document);
  update();if(nodes.length||stamps.length)root.setInterval(update,1000);
  const market=root.document.getElementById?.('event-market'),type=root.document.getElementById?.('event-type');
  const events=[...root.document.querySelectorAll('[data-event-market]')];
  const empty=root.document.getElementById?.('event-filter-empty');
  const filter=()=>{let visible=0;events.forEach(node=>{node.hidden=!!((market?.value&&market.value!==node.dataset.eventMarket)||(type?.value&&type.value!==node.dataset.eventType));if(!node.hidden)visible++;});if(empty)empty.hidden=visible>0;};
  market?.addEventListener('change',filter);type?.addEventListener('change',filter);
})(typeof window==='undefined'?{}:window);
