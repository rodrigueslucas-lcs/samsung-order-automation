/* Presentation only: no requests, storage, auth operations or schedule changes. */
(function(root){
  function countdown(target,now){
    if(!Number.isFinite(target)||!Number.isFinite(now))return 'Next check unavailable';
    const seconds=Math.ceil((target-now)/1000);
    if(seconds<=0)return 'Scheduled check due · awaiting update';
    return 'Next check in '+Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';
  }
  if(typeof module==='object'&&module.exports)module.exports={countdown};
  if(!root.document)return;
  const nodes=[...root.document.querySelectorAll('[data-next-check]')];
  const update=()=>nodes.forEach(node=>{node.textContent=countdown(Number(node.dataset.nextCheck),Date.now());});
  update();if(nodes.length)root.setInterval(update,1000);
})(typeof window==='undefined'?{}:window);
