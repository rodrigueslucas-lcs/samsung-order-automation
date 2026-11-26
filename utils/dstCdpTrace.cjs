const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { unzipSync } = require('fflate');

// The CDP page belongs to an existing context, not Playwright's test fixture.
// Capture that actual context and finish its public tracing API before closing
// the owned page/disconnecting. Do not rely on the worker's test-only ZIP rename.
async function startDstCdpTrace(context, testInfo) {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  return async () => {
    const file = testInfo.outputPath('trace.zip');
    await context.tracing.stop({ path: file });
    const archive = await fs.readFile(file);
    const entries = unzipSync(archive, { filter: entry => /\.(trace|network)$/.test(entry.name) });
    const browserTrace = Object.keys(entries).find(name => name !== 'test.trace' && name.endsWith('.trace') && entries[name].length);
    if (!browserTrace || !Object.hasOwn(entries, browserTrace.replace(/\.trace$/, '.network'))) {
      throw new Error('DST_CDP_TRACE_INVALID: mandatory browser trace/network archive was not produced.');
    }
    await testInfo.attach('trace', { path: file, contentType: 'application/zip' });
    testInfo.annotations.push({ type: 'dst-cdp-trace', description: JSON.stringify({
      capture: 'PUBLIC_CONTEXT_TRACING_BEFORE_DISCONNECT', bytes: archive.length,
      sha256: crypto.createHash('sha256').update(archive).digest('hex'),
    }) });
  };
}

module.exports = { startDstCdpTrace };
