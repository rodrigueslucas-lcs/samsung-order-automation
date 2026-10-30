/* Presentation only: no requests, storage, auth operations or schedule changes. */
(function(root){
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
  if(typeof module==='object'&&module.exports)module.exports={countdown,freshness,humanizeStatus};
  if(!root.document)return;
  const nodes=[...root.document.querySelectorAll('[data-next-check]')];
  const stamps=[...root.document.querySelectorAll('[data-generated-at]')];
  const update=()=>{nodes.forEach(node=>{node.textContent=countdown(Number(node.dataset.nextCheck),Date.now());});stamps.forEach(node=>{node.textContent=freshness(node.dataset.generatedAt,Date.now());});};
  polishStatusChips(root.document);
  polishSummary(root.document);
  polishHumanActions(root.document);
  update();if(nodes.length||stamps.length)root.setInterval(update,1000);
  const market=root.document.getElementById?.('event-market'),type=root.document.getElementById?.('event-type');
  const events=[...root.document.querySelectorAll('[data-event-market]')];
  const empty=root.document.getElementById?.('event-filter-empty');
  const filter=()=>{let visible=0;events.forEach(node=>{node.hidden=!!((market?.value&&market.value!==node.dataset.eventMarket)||(type?.value&&type.value!==node.dataset.eventType));if(!node.hidden)visible++;});if(empty)empty.hidden=visible>0;};
  market?.addEventListener('change',filter);type?.addEventListener('change',filter);
})(typeof window==='undefined'?{}:window);
