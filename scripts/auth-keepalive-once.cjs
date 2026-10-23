const { runKeepAliveCycle } = require('../utils/authKeepAliveRunner.cjs');
const { publisherEnvironment } = require('../utils/jenkinsPublisherConfig.cjs');

function parseArgs(argv) {
  let publish = process.env.AUTH_KEEPALIVE_PUBLISH !== '0';
  let environment = process.env.AUTH_KEEPALIVE_ENVIRONMENT || process.env.ENVIRONMENT || 'S2';
  for (const arg of argv) {
    if (arg === '--no-publish') publish = false;
    else if (arg === '--publish') publish = true;
    else if (arg.startsWith('--environment=')) environment = arg.slice('--environment='.length);
    else throw new Error(`Unsupported keep-alive argument: ${arg}`);
  }
  return { publish, environment: String(environment).trim().toUpperCase() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let runtimeEnv = { ...process.env };
  if (args.publish) runtimeEnv = publisherEnvironment(runtimeEnv);
  const summary = await runKeepAliveCycle({
    environment: args.environment,
    publish: args.publish,
    env: runtimeEnv,
  });
  if (!summary.ok) {
    const human = summary.blocking.filter(result => result.status === 'HUMAN_REQUIRED');
    process.exitCode = human.length ? 2 : 1;
  }
}

main().catch(error => {
  console.error(`[auth:keepalive] FAILED · ${String(error.message || error).split('\n')[0]}`);
  process.exitCode = 1;
});

module.exports = { parseArgs };
