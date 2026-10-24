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
  if(typeof module==='object'&&module.exports)module.exports={countdown,freshness};
  if(!root.document)return;
  const nodes=[...root.document.querySelectorAll('[data-next-check]')];
  const stamps=[...root.document.querySelectorAll('[data-generated-at]')];
  const update=()=>{nodes.forEach(node=>{node.textContent=countdown(Number(node.dataset.nextCheck),Date.now());});stamps.forEach(node=>{node.textContent=freshness(node.dataset.generatedAt,Date.now());});};
  update();if(nodes.length||stamps.length)root.setInterval(update,1000);
  const market=root.document.getElementById?.('event-market'),type=root.document.getElementById?.('event-type');
  const events=[...root.document.querySelectorAll('[data-event-market]')];
  const empty=root.document.getElementById?.('event-filter-empty');
  const filter=()=>{let visible=0;events.forEach(node=>{node.hidden=!!((market?.value&&market.value!==node.dataset.eventMarket)||(type?.value&&type.value!==node.dataset.eventType));if(!node.hidden)visible++;});if(empty)empty.hidden=visible>0;};
  market?.addEventListener('change',filter);type?.addEventListener('change',filter);
})(typeof window==='undefined'?{}:window);
