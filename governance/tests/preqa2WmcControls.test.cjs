const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { findPreqa2Control, isExpectedWmcTransition } = require('../../utils/preqa2WmcControls.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(body, action) {
  const page = await browser.newPage();
  try { await page.setContent(body); await action(page); } finally { await page.close(); }
}
test('real WMC nested spans in China Support and QA groups select only the QA Preqa2 action', async () => {
  await fixture('<dl><dt>China B2C/B2B Support</dt><dd><a id="china" href="javascript:goLink(1)"><span>Preqa2</span></a></dd></dl><dl><dt>QA</dt><dd><a id="qa" href="javascript:goLink(2)"><span>Preqa2</span></a></dd></dl>', async page => {
    assert.equal(await (await findPreqa2Control(page)).getAttribute('id'), 'qa');
  });
});
test('a single actionable link is not duplicated by its nested text label', async () => {
  await fixture('<a id="qa" href="javascript:goLink(2)"><span>Preqa2</span></a>', async page => {
    assert.equal(await (await findPreqa2Control(page)).getAttribute('id'), 'qa');
  });
});
test('exact approved HTTPS host wins and a lookalike hostname is never accepted', async () => {
  await fixture('<a href="https://p6-pre-qa2.samsung.com.invalid/">Preqa2</a><a id="approved" href="https://p6-pre-qa2.samsung.com/sites/">Preqa2</a>', async page => {
    assert.equal(await (await findPreqa2Control(page)).getAttribute('id'), 'approved');
  });
});
test('two QA destinations remain ambiguous and neither is clicked', async () => {
  await fixture('<dl><dt>QA</dt><dd><a href="javascript:goLink(1)">Preqa2</a><a href="javascript:goLink(2)">Preqa2</a></dd></dl>', async page => {
    await assert.rejects(findPreqa2Control(page), /remain ambiguous/);
  });
});
test('an explicit unapproved or Production destination is not used as fallback', async () => {
  await fixture('<dl><dt>QA</dt><dd><a href="https://www.samsung.com/">Preqa2</a></dd></dl>', async page => {
    await assert.rejects(findPreqa2Control(page), /remain ambiguous/);
  });
});
test('only a known closed-page transition in a live browser with surviving pages may continue', () => {
  const context = { browser: () => ({ isConnected: () => true }), pages: () => [{ isClosed: () => false }] };
  const error = Error('locator.all: Target page, context or browser has been closed');
  assert.ok(isExpectedWmcTransition(error, context));
  assert.ok(!isExpectedWmcTransition(Error('Multiple destinations'), context));
  assert.ok(!isExpectedWmcTransition(error, { ...context, pages: () => [] }));
  assert.ok(!isExpectedWmcTransition(error, { ...context, browser: () => ({ isConnected: () => false }) }));
});
