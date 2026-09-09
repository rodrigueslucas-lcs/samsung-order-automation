const WMC_HOST = "wds.samsung.com";
const PREQA2_HOST = "p6-pre-qa2.samsung.com";
const CORPORATE_AUTH_HOSTS = Object.freeze([
  "scloud.singleid.samsung.net",
  "sp.sec.samsung.net",
  "sts.secsso.net",
]);

function safePageIdentity(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "N/A";
  }
}

function classifyWmcUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "unknown";
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === PREQA2_HOST) {
    return /\/apps\/samsung\/login\//i.test(url.pathname) ? "preqa2-gate" : "preqa2";
  }
  if (CORPORATE_AUTH_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return /singleid|verification|mfa/i.test(`${hostname}${url.pathname}`) ? "mfa" : "sso";
  }
  if (hostname === WMC_HOST) {
    return /\/sso\/login\//i.test(url.pathname) ? "wmc-login" : "wmc";
  }
  return "other";
}

module.exports = {
  CORPORATE_AUTH_HOSTS,
  PREQA2_HOST,
  WMC_HOST,
  classifyWmcUrl,
  safePageIdentity,
};
