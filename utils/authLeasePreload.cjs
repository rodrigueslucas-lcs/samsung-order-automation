const { registerLeaseProcess } = require('./authMarketLease.cjs');
// Every Node descendant in a protected CI batch participates in the lease.
// A live worker therefore prevents stale-owner takeover after its launcher dies.
if (process.env.AUTH_MARKET_LEASE) {
  const leave = registerLeaseProcess();
  process.once('exit', leave);
}
