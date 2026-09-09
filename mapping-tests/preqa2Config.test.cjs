const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PREQA2_HOST,
  getPreqa2Config,
  normalizePreqa2Market,
  parsePreqa2Url,
} = require("../utils/preqa2Config");
const { isWmcLoginGate } = require("../utils/preqa2Bootstrap");
const { classifyWmcUrl, safePageIdentity } = require("../utils/wmcSessionState");

test("builds approved PreQA2 routes for every SMB market", () => {
  for (const market of ["mx", "cl", "co", "pe"]) {
    const config = getPreqa2Config({ PREQA2_MARKET: market });
    assert.equal(config.hostname, PREQA2_HOST);
    assert.equal(config.sitesUrl.toString(), `https://${PREQA2_HOST}/sites/`);
    assert.equal(config.bootstrapUrl.toString(), `https://${PREQA2_HOST}/getcookies`);
    assert.equal(config.storefrontUrl.toString(), `https://${PREQA2_HOST}/${market}/`);
  }
});

test("rejects unapproved markets and hosts", () => {
  assert.throws(() => normalizePreqa2Market("us"), /must be one of/);
  assert.throws(
    () => parsePreqa2Url("https://www.samsung.com/mx/", "target"),
    /must use the Samsung WMC PreQA2 host/
  );
});

test("recognizes the observed WMC authentication gate", () => {
  assert.equal(
    isWmcLoginGate("https://p6-pre-qa2.samsung.com/apps/samsung/login/content/login.html", ""),
    true
  );
  assert.equal(isWmcLoginGate("https://p6-pre-qa2.samsung.com/sites/", "Please login through WMC"), true);
  assert.equal(isWmcLoginGate("https://p6-pre-qa2.samsung.com/mx/", "Samsung Mexico"), false);
});

test("classifies WMC, SSO, SingleID MFA and PreQA2 without retaining query strings", () => {
  assert.equal(classifyWmcUrl("https://wds.samsung.com/wds/sso/login/forwardLogin.do"), "wmc-login");
  assert.equal(classifyWmcUrl("https://wds.samsung.com/wds/sso/login/ssoLoginSuccess.do"), "wmc");
  assert.equal(classifyWmcUrl("https://wds.samsung.com/wds/main.do"), "wmc");
  assert.equal(
    classifyWmcUrl("https://scloud.singleid.samsung.net/secdx/common/verification/select?requestId=secret"),
    "mfa"
  );
  assert.equal(classifyWmcUrl("https://p6-pre-qa2.samsung.com/mx/"), "preqa2");
  assert.equal(
    safePageIdentity("https://scloud.singleid.samsung.net/path?requestId=secret"),
    "https://scloud.singleid.samsung.net/path"
  );
});
