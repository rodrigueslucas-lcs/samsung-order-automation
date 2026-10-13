const test = require("node:test");
const assert = require("node:assert/strict");
const { waitForMxAccountField, hasMxAccountReturned, redactMxAuthError } = require("../../utils/mxAuthLoginStep.cjs");

function fixture({ visible = () => false, change = () => {} } = {}) {
  const state = { time: 0, url: "https://account.samsung.com/signin", closed: false };
  return {
    state,
    page: { url: () => state.url, isClosed: () => state.closed },
    field: { isVisible: async () => visible(state) },
    options: { hostname: "stg.shop.samsung.com", timeout: 1000,
      now: () => state.time, pause: async ms => { state.time += ms; change(state); } },
  };
}

for (const hostname of ["stg.shop.samsung.com", "stg2.shop.samsung.com"]) {
  test(`MX warm SSO returns while email is absent on ${hostname}`, async () => {
    const f = fixture({ change: s => { s.url = `https://${hostname}/mx/`; } });
    f.options.hostname = hostname;
    assert.equal(await waitForMxAccountField(f.page, f.field, f.options), "returned");
    assert.equal(f.state.time, 250);
  });
}

test("MX login proceeds when the field renders without a redirect", async () => {
  const f = fixture({ visible: s => s.time >= 500 });
  assert.equal(await waitForMxAccountField(f.page, f.field, f.options), "field");
  assert.equal(f.state.time, 500);
});

test("MX password-stage redirect and closed login popup hand off to auth verification", async () => {
  const f = fixture({ change: s => { s.closed = true; } });
  assert.equal(await waitForMxAccountField(f.page, f.field, f.options), "returned");
  // This result is intentionally not an authenticated-state assertion.
  assert.equal(hasMxAccountReturned(f.page, f.options.hostname), true);
});

test("MX login rejects a foreign environment, another market and a hanging provider", async () => {
  for (const url of ["https://stg2.shop.samsung.com/mx/", "https://stg.shop.samsung.com/cl/", "https://account.samsung.com/signin"]) {
    const f = fixture();
    f.state.url = url;
    await assert.rejects(waitForMxAccountField(f.page, f.field, f.options), /required login field or return/);
  }
});

test("MX auth errors redact OAuth URLs, identity and Playwright call logs", () => {
  const error = new Error('Timeout for https://s1-smb-api-cdn.ecom-stg.samsung.com/mx/login/return?code=secret-code&state=secret-state user@example.test\nCall log: another-secret');
  const safe = redactMxAuthError(error);
  assert.match(safe, /redacted-url/);
  assert.match(safe, /redacted-email/);
  assert.doesNotMatch(safe, /secret|user@example|Call log|https:/);
});
