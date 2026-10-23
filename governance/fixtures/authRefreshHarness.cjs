const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { refreshAuth } = require('../../utils/authRefreshRunner.cjs');

async function runRefreshFixture(market, env, statuses = [0, 0, 0]) {
  const calls = [], output = [], pending = [];
  const runtime = { env, exitCode: 0 };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../../scripts/auth-refresh-${market}.cjs`), 'utf8'), {
    process: runtime,
    console: { log: line => output.push(line), error: line => output.push(line) },
    require: name => {
      if (name !== '../utils/authRefreshRunner.cjs') throw new Error('Unexpected operator dependency.');
      return { refreshAuth: options => {
        const result = refreshAuth(options, {
          acquire: () => () => {}, log: line => output.push(line),
          runChild: async (script, env) => { calls.push({ script, env }); return statuses.shift() ?? 0; },
        });
        pending.push(result); return result;
      } };
    },
  });
  await Promise.allSettled(pending);
  return { calls, output: output.join('\n'), exitCode: runtime.exitCode };
}
module.exports = { runRefreshFixture };
