// Normal provider UI only: never read QR contents, submit credentials or solve
// a challenge. Missing QR support leaves the existing manual login available.
async function openSecondAccountQr(page,{slot,log=console.log}={}) {
  if(slot!=='second')return false;
  try {
    const url=new URL(page.url());
    if(url.protocol!=='https:'||url.hostname!=='account.samsung.com')return false;
    const scan=page.getByText(/Escanea.*(?:QR|c[oó]digo)|Scan.*QR|Escanear.*QR/i).filter({visible:true}).first();
    if(await scan.isVisible())return true;
    const name=/(?:c[oó]digo\s*QR|QR\s*code|con\s*QR|with\s*QR)/i;
    for(const role of ['button','link']) {
      const option=page.getByRole(role,{name}).filter({visible:true}).first();
      if(!await option.isVisible())continue;
      if(role==='link') {
        const href=await option.getAttribute('href');
        if(href){const target=new URL(href,url);if(target.protocol!=='https:'||target.hostname!==url.hostname)continue;}
      }
      await option.click({timeout:5000});
      log('[auth:qr] SECOND: QR option selected once. Scan with the SECOND account; verification remains manual.');
      return true;
    }
  }catch{/* Navigation/detachment is not a reason to repeat the QR click. */}
  log('[auth:qr] SECOND: QR option unavailable; manual login remains available.');
  return false;
}
module.exports={openSecondAccountQr};
