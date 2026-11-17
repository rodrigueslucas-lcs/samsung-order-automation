// Normal provider UI only: never read QR contents, submit credentials or solve
// a challenge. Missing QR support leaves the existing manual login available.
async function openSecondAccountQr(page,{slot,log=console.log,timeout=30000}={}) {
  if(slot!=='second')return false;
  try {
    const url=new URL(page.url());
    if(url.protocol!=='https:'||url.hostname!=='account.samsung.com')return false;
    if(url.pathname==='/iam/sign-in/credentials/qr-code')return true;
    const scan=page.getByText(/Escanea.*(?:QR|c[oó]digo)|Scan.*QR|Escanear.*QR/i).filter({visible:true}).first();
    if(await scan.isVisible())return true;
    const name=/(?:c[oó]digo\s*QR|QR\s*code|con\s*QR|with\s*QR)/i;
    const choices=['button','link'].map(role=>({role,option:page.getByRole(role,{name}).filter({visible:true}).first()}));
    // OAuth returns before Samsung mounts its sign-in controls. Observe both
    // supported controls concurrently; two short sequential probes can miss
    // the button that appears while the link probe is already running.
    await Promise.any(choices.map(async({option})=>{
      await option.waitFor({state:'visible',timeout});
      if(!await option.isVisible())throw Error('QR control not ready');
    })).catch(()=>{});
    for(const {role,option} of choices) {
      if(!await option.isVisible())continue;
      if(role==='link') {
        const href=await option.getAttribute('href');
        if(href){const target=new URL(href,url);if(target.protocol!=='https:'||target.hostname!==url.hostname)continue;}
      }
      await option.click({timeout:5000});
      if(typeof page.waitForURL==='function')await page.waitForURL(value=>value.hostname==='account.samsung.com'&&value.pathname==='/iam/sign-in/credentials/qr-code',{waitUntil:'commit',timeout:15000});
      log('[auth:qr] SECOND: QR option selected once. Scan with the SECOND account; verification remains manual.');
      return true;
    }
  }catch{/* Navigation/detachment is not a reason to repeat the QR click. */}
  log('[auth:qr] SECOND: QR option unavailable; manual login remains available.');
  return false;
}
module.exports={openSecondAccountQr};
