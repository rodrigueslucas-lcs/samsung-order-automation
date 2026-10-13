const test = require("node:test");
const assert = require("node:assert/strict");
const { waitForClAuthenticatedReturn, assertClSsoConfiguration, validatedClSsoLoginUrl } = require("../../utils/clAuthLoginReturn.cjs");

const target = { hostname: "stg2.shop.samsung.com", environment: "S2" };
function ssoInfo(callback = "https://stg2.shop.samsung.com/cl/login/authorize") {
  const url = new URL("https://account.samsung.com/accounts/v1/sec_stg_s2_smb/signInGate");
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("goBackURL", "https://stg2.shop.samsung.com/cl/login/goback");
  return { ssoLoginUrl: url.href };
}

test("CL currentConfig degradation does not block a valid independently supplied SSO login", () => {
  assert.doesNotThrow(() => assertClSsoConfiguration({ status: 400 }, ssoInfo(), target));
  assert.equal(new URL(validatedClSsoLoginUrl(ssoInfo(), target)).hostname, "account.samsung.com");
});

test("CL backend SSO rejects foreign/Production callbacks and other market routes", () => {
  for (const callback of ["https://shop.samsung.com/cl/login/authorize", "https://stg2.shop.samsung.com/mx/login/authorize", "http://stg2.shop.samsung.com/cl/login/authorize"]) {
    assert.throws(() => validatedClSsoLoginUrl(ssoInfo(callback), target), /leaves the selected CL staging/);
  }
  assert.throws(() => validatedClSsoLoginUrl({ ssoLoginUrl: "https://example.test/login" }, target), /provider does not match/);
});

function page(url) {
  return { url: () => url, isClosed: () => false };
}

test("CL configuration HTTP 400 without a valid SSO alternative is non-retryable", () => {
  assert.throws(() => assertClSsoConfiguration({ status: 400, errorType: "JaloSystemError" }), error => {
    assert.equal(error.exitCode, 78);
    assert.match(error.message, /HTTP 400; JaloSystemError/);
    assert.match(error.message, /No credentials were submitted/);
    return true;
  });
});

test("CL configuration guard accepts success and does not invent an error without a response", () => {
  assert.doesNotThrow(() => assertClSsoConfiguration({ status: 200 }));
  assert.doesNotThrow(() => assertClSsoConfiguration(null));
});

test("CL popup login does not accept the pre-existing signed-out home tab", async () => {
  let time = 0;
  let closed = false;
  let reads = 0;
  const home = page("https://stg2.shop.samsung.com/cl/");
  const account = { ...page("https://account.samsung.com/iam/signin"), isClosed: () => closed };
  const result = await waitForClAuthenticatedReturn({ pages: () => [home, account] }, {
    hostname: "stg2.shop.samsung.com",
    accountPage: account,
    now: () => time,
    pause: async ms => { time += ms; closed = true; },
    readAccountState: async candidate => {
      assert.equal(closed, true);
      assert.equal(candidate, home);
      reads += 1;
      return { state: "authenticated" };
    },
  });
  assert.equal(result, home);
  assert.equal(reads, 1);
  assert.equal(time, 500);
});

test("CL same-tab return waits for positive authentication after the redirect", async () => {
  let time = 0;
  let reads = 0;
  const home = page("https://stg2.shop.samsung.com/cl/");
  const result = await waitForClAuthenticatedReturn({ pages: () => [home] }, {
    hostname: "stg2.shop.samsung.com",
    accountPage: home,
    now: () => time,
    pause: async ms => { time += ms; },
    readAccountState: async () => ({ state: ++reads === 1 ? "signed-out" : "authenticated" }),
  });
  assert.equal(result, home);
  assert.equal(reads, 2);
});

test("CL return rejects a signed-out storefront even when its URL is correct", async () => {
  let time = 0;
  await assert.rejects(waitForClAuthenticatedReturn({ pages: () => [page("https://stg2.shop.samsung.com/cl/")] }, {
    hostname: "stg2.shop.samsung.com",
    timeout: 1000,
    now: () => time,
    pause: async ms => { time += ms; },
    readAccountState: async () => ({ state: "signed-out" }),
  }), /did not return an authenticated storefront/);
});

test("CL return ignores foreign hosts and other market routes", async () => {
  let time = 0;
  await assert.rejects(waitForClAuthenticatedReturn({ pages: () => [
    page("https://stg2.shop.samsung.com/mx/"),
    page("https://stg.shop.samsung.com/cl/"),
  ] }, {
    hostname: "stg2.shop.samsung.com",
    timeout: 500,
    now: () => time,
    pause: async ms => { time += ms; },
    readAccountState: async () => { assert.fail("Must not inspect an unrelated market/environment"); },
  }), /did not return an authenticated storefront/);
});

test("CL signed-out callback stops after three checks instead of hovering for the entire human-login deadline", async () => {
  let time = 0;
  let reads = 0;
  const home = page("https://stg2.shop.samsung.com/cl/");
  await assert.rejects(waitForClAuthenticatedReturn({ pages: () => [home] }, {
    hostname: "stg2.shop.samsung.com",
    timeout: 600000,
    now: () => time,
    pause: async ms => { time += ms; },
    readAccountState: async () => { reads += 1; return { state: "signed-out" }; },
  }), error => error.exitCode === 78 && /remains signed-out/.test(error.message));
  assert.equal(reads, 3);
  assert.ok(time < 15000);
});
