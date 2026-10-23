const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const { sessionContentHash } = require('./authBundleContent.cjs');
const { writeJsonAtomically } = require('./atomicJson');
function recordPublication(market, environment, submittedBytes) {
  const bundle = JSON.parse(submittedBytes.toString('utf8'));
  if (bundle.market !== market.toUpperCase() || bundle.environment !== environment) throw new Error('Published bundle identity does not match.');
  const file = path.resolve('playwright/.auth', `.keepalive-${market}-${environment.toLowerCase()}.json`);
  let state = {};
  try { state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('Publication checkpoint cannot be read.'); }
  writeJsonAtomically(file, { ...state, publishedContentHash: sessionContentHash(bundle), publishedFileHash: crypto.createHash('sha256').update(submittedBytes).digest('hex') });
}
module.exports = { recordPublication };
