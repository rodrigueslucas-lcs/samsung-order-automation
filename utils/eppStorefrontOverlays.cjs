const installed=new WeakSet();
function inProgramme(page,config){try{const url=new URL(page.url());return url.origin===config.rootUrl.origin&&url.pathname.startsWith(config.rootUrl.pathname);}catch{return false;}}
async function dismissEppNotificationTutorial(page,config){
 if(!inProgramme(page,config))return false;
 const notice=page.locator('#ins-web-opt-in-reminder-container');
 const close=notice.locator('.ins-web-opt-in-reminder-close-button').filter({visible:true}).first();
 if(!await close.isVisible().catch(()=>false))return false;
 await close.click({timeout:3000});
 await notice.waitFor({state:'hidden',timeout:3000});
 return true;
}
async function installEppOverlayDismissal(page,config){
 if(!installed.has(page)){
  installed.add(page);
  await page.addLocatorHandler(page.locator('#ins-web-opt-in-reminder-container .ins-web-opt-in-reminder-close-button').filter({visible:true}).first(),async()=>{await dismissEppNotificationTutorial(page,config);},{noWaitAfter:true});
 }
 await dismissEppNotificationTutorial(page,config);
}
module.exports={dismissEppNotificationTutorial,installEppOverlayDismissal};
