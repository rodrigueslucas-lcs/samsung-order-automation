// EPP is Chromium-only. Fetch interception checks every HTTP redirect hop,
// without proxying auth requests, rewriting callbacks or exposing cookies.
function blockedEppRequest(config, {url: value, method='GET', document=false, top=false}) {
  const url = new URL(value);
  const api = `https://${config.environment === 'S1' ? 's1' : 's2'}-smb-api-cdn.ecom-stg.samsung.com`;
  const production = ['samsung.com','www.samsung.com','shop.samsung.com'].includes(url.hostname) ||
    (url.hostname.endsWith('.shop.samsung.com') && !['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(url.hostname));
  const commerceWrite = url.pathname.startsWith('/tokocommercewebservices/') && !['GET','HEAD','OPTIONS'].includes(method);
  const allowed = url.origin === config.rootUrl.origin || url.origin === 'https://account.samsung.com' ||
    (url.origin === api && /^\/tokocommercewebservices\/v2\/[^/]+\/login\/return\/?$/.test(url.pathname));
  const reason = document && production ? 'PRODUCTION_NAVIGATION_BLOCKED' :
    document && top && !allowed ? 'UNAPPROVED_NAVIGATION_BLOCKED' :
    commerceWrite && ![config.rootUrl.origin,api].includes(url.origin) ? 'UNAPPROVED_COMMERCE_WRITE_BLOCKED' : null;
  return reason ? {reason,host:url.hostname} : null;
}
async function installEppNavigationGuard(context, config) {
  let last = null;
  const sessions = new Map();
  const protectPage = page => {
    if (!sessions.has(page)) sessions.set(page,(async()=>{
      const session = await context.newCDPSession(page);
      const {frameTree} = await session.send('Page.getFrameTree');
      session.on('Fetch.requestPaused', async event => {
        const blocked = blockedEppRequest(config,{...event.request,document:event.resourceType==='Document',top:event.frameId===frameTree.frame.id});
        try {
          if (blocked) {
            last={...blocked,path:safeNavigationPath(event.request.url)};
            await session.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});
          }
          else await session.send('Fetch.continueRequest',{requestId:event.requestId});
        } catch { /* Target may close during interception; never retry its request. */ }
      });
      await session.send('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Document'},{urlPattern:'*/tokocommercewebservices/*'}]});
      return session;
    })());
    return sessions.get(page);
  };
  const onPage = page => { protectPage(page).catch(()=>{}); };
  context.on('page',onPage);
  await Promise.all(context.pages().map(protectPage));
  return {lastBlocked:()=>last,protectPage,dispose:async()=>{
    context.off('page',onPage);
    for(const pending of sessions.values()) {
      const session=await pending;
      await session.send('Fetch.disable').catch(()=>{});
      await session.detach().catch(()=>{});
    }
  }};
}
function safeNavigationPath(value) {
  return new URL(value).pathname.replace(/[^/]*(?:@|%40)[^/]*/gi,'[identity]').replace(/[A-Za-z0-9_%.-]{48,}/g,'[opaque]');
}
module.exports={installEppNavigationGuard,blockedEppRequest,safeNavigationPath};
