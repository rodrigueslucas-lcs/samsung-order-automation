function validatedStorefrontSsoLoginUrl(info, { market, hostname, environment }) {
  const label = String(market).toUpperCase();
  if (!['mx','pe','co','cl'].includes(market) || !['S1','S2'].includes(environment) ||
      hostname !== (environment === 'S2' ? 'stg2.shop.samsung.com' : 'stg.shop.samsung.com')) throw Error('Invalid staging SSO scope.');
  let url;
  try { url = new URL(info?.ssoLoginUrl); } catch { throw Error(`${label} backend did not provide a valid Samsung Account login URL.`); }
  const provider = environment === 'S2' ? 'sec_stg_s2_smb' : 'sec_stg_s1_smb';
  if (url.origin !== 'https://account.samsung.com' || url.username || url.password || url.pathname !== `/accounts/v1/${provider}/signInGate`) throw Error(`${label} backend SSO provider does not match the selected staging environment.`);
  for (const key of ['redirect_uri','goBackURL']) {
    let callback;
    try { callback = new URL(url.searchParams.get(key)); } catch { throw Error(`${label} backend SSO callback is missing or invalid.`); }
    if (callback.origin !== `https://${hostname}` || callback.username || callback.password || !callback.pathname.startsWith(`/${market}/login/`)) throw Error(`${label} backend SSO callback leaves the selected ${label} staging storefront.`);
  }
  return url.href;
}

async function openOfficialStorefrontLogin(page, info, target) {
  const loginUrl = validatedStorefrontSsoLoginUrl(info, target);
  const current = new URL(page.url());
  if (current.origin !== `https://${target.hostname}` || current.pathname.replace(/\/$/,'') !== `/${target.market}`) throw Error('Official SSO must start from its own staging market home.');
  await page.waitForFunction(() => typeof window.samsung?.account?.signIn === 'function', null, { timeout: 30000 });
  // Same IAM SDK invocation as the storefront. Do not navigate directly to
  // signInGate: that would omit the provider's browser-side initialization.
  await page.evaluate(url => {
    const parameters = new URL(url).searchParams;
    window.samsung.account.signIn({
      clientId: parameters.get('client_id'),
      redirectUri: encodeURIComponent(parameters.get('redirect_uri')),
      responseType: parameters.get('response_type'),
      state: parameters.get('state'),
    }, { locale: `${parameters.get('locale').split('_')[0]}-${parameters.get('countryCode')}` });
  }, loginUrl);
}
module.exports = { validatedStorefrontSsoLoginUrl, openOfficialStorefrontLogin };
