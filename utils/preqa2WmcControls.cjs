const { PREQA2_HOST } = require('./wmcSessionState');

function isExpectedWmcTransition(error, context) {
  return /Target page, context or browser has been closed|Frame was detached|Execution context was destroyed/i.test(String(error?.message || '')) &&
    context.browser()?.isConnected() === true && context.pages().some(page => !page.isClosed());
}

async function findPreqa2Control(page) {
  const controls = [];
  for (const frame of page.frames()) {
    try {
      let candidates = frame.getByRole('link', { name: /^Preqa2$/i })
        .or(frame.getByRole('button', { name: /^Preqa2$/i })).filter({ visible: true });
      // Prefer actionable controls; mixing their nested label spans into the
      // same union makes one link look like multiple destinations.
      if (!await candidates.count()) candidates = frame.getByText(/^Preqa2$/i).filter({ visible: true });
      for (const candidate of await candidates.all()) {
        const metadata = await candidate.evaluate(element => {
          const action = element.closest('a,button,[role="link"],[role="button"]') || element;
          return { href: action.getAttribute('href') || '', group: action.closest('dl')?.querySelector(':scope > dt')?.textContent?.trim() || '' };
        });
        let approved = false;
        const opaque = !metadata.href || /^javascript:/i.test(metadata.href);
        try { const url = new URL(metadata.href, page.url()); approved = url.protocol === 'https:' && url.hostname === PREQA2_HOST; } catch {}
        controls.push({ candidate, approved, opaque, qaGroup: /^QA$/i.test(metadata.group) });
      }
    } catch (error) {
      if (page.isClosed() || frame.isDetached()) continue;
      throw error;
    }
  }
  const approved = controls.filter(control => control.approved);
  if (approved.length === 1) return approved[0].candidate;
  // WMC renders China Support and QA Preqa2 links with opaque goLink(...)
  // handlers. Only the proven QA definition-list group identifies this lane.
  const qa = controls.filter(control => control.qaGroup && control.opaque);
  if (!approved.length && qa.length === 1) return qa[0].candidate;
  if (controls.length === 1 && controls[0].opaque) return controls[0].candidate;
  if (controls.length) throw new Error('Multiple Preqa2 controls remain ambiguous; no approved host or unique QA group was identified.');
  return null;
}

module.exports = { findPreqa2Control, isExpectedWmcTransition };
