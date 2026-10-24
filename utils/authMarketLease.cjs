const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const crypto = require('node:crypto');
function leaseDirectory(env = process.env) { return path.resolve(env.AUTH_COORDINATION_DIR || path.join(env.ProgramData || env.PROGRAMDATA || os.tmpdir(), 'SamsungSMB', 'AuthLeases')); }
function ownerAlive(folder, current, alive) {
  if (alive(current.pid)) return true;
  const members = path.join(folder, 'members');
  if (!fs.existsSync(members)) return false;
  return fs.readdirSync(members).some(name => { try { const member = JSON.parse(fs.readFileSync(path.join(members, name), 'utf8')); return member.token !== current.token || alive(member.pid); } catch { return true; } });
}
function busy() { const error = new Error('Auth market/profile is occupied or its owner cannot be verified.'); error.code = 'AUTH_BUSY'; return error; }
function acquireMarketLease(market, environment, { env = process.env, directory = leaseDirectory(env), pid = process.pid, alive = owner => { try { process.kill(owner, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } } } = {}) {
  if (!['mx','pe','co','cl'].includes(market) || !['S1','S2'].includes(environment)) throw new Error('Invalid auth market lease identity.');
  fs.mkdirSync(directory, { recursive: true });
  const folder = path.join(directory, `${environment.toLowerCase()}-${market}.lock`);
  const file = path.join(folder, 'owner.json');
  let current;
  if (fs.existsSync(folder)) {
    try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw busy(); }
    if (env.AUTH_MARKET_LEASE === current.token && current.hostname === os.hostname() && ownerAlive(folder, current, alive)) {
      const release = () => {}; release.env = { AUTH_MARKET_LEASE: current.token, AUTH_COORDINATION_DIR: directory, AUTH_MARKET_LEASE_MARKET: market, AUTH_MARKET_LEASE_ENVIRONMENT: environment }; return release;
    }
    if (current.hostname !== os.hostname() || !Number.isInteger(current.pid) || ownerAlive(folder, current, alive)) throw busy();
    // Exclusive reaper prevents two contenders from deleting a newly acquired lease.
    const reaper = `${folder}.reap`;
    try { fs.mkdirSync(reaper); } catch { throw busy(); }
    try {
      const latest = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (latest.token !== current.token || ownerAlive(folder, latest, alive)) throw busy();
      const members = path.join(folder, 'members');
      if (fs.existsSync(members)) { for (const name of fs.readdirSync(members)) fs.unlinkSync(path.join(members, name)); fs.rmdirSync(members); }
      fs.unlinkSync(file); fs.rmdirSync(folder);
    } finally { fs.rmdirSync(reaper); }
  }
  try { fs.mkdirSync(folder); } catch (e) { if (e.code === 'EEXIST') throw busy(); throw e; }
  fs.mkdirSync(path.join(folder, 'members'));
  const owner = { pid, hostname: os.hostname(), token: crypto.randomUUID() };
  try { fs.writeFileSync(file, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); } catch (e) { fs.rmdirSync(path.join(folder, 'members')); fs.rmdirSync(folder); throw e; }
  const release = () => {
    try {
      const latest = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (latest.token !== owner.token) return;
      const members = path.join(folder, 'members');
      for (const name of fs.readdirSync(members)) {
        const memberFile = path.join(members, name);
        let member;
        try { member = JSON.parse(fs.readFileSync(memberFile, 'utf8')); }
        catch { throw busy(); }
        // Fatal process exits can skip JS exit listeners. Only proven-dead
        // children of this exact lease can be removed during release.
        if (member.token !== owner.token || !Number.isInteger(member.pid) || alive(member.pid)) throw busy();
        fs.unlinkSync(memberFile);
      }
      fs.rmdirSync(members);
      fs.unlinkSync(file);
      fs.rmdirSync(folder);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  };

  release.env = { AUTH_MARKET_LEASE: owner.token, AUTH_COORDINATION_DIR: directory, AUTH_MARKET_LEASE_MARKET: market, AUTH_MARKET_LEASE_ENVIRONMENT: environment }; return release;
}
function registerLeaseProcess(env = process.env, pid = process.pid) {
  if (!env.AUTH_MARKET_LEASE) return () => {};
  if (!['mx','pe','co','cl'].includes(env.AUTH_MARKET_LEASE_MARKET) || !['S1','S2'].includes(env.AUTH_MARKET_LEASE_ENVIRONMENT)) throw busy();
  const folder = path.join(leaseDirectory(env), String(env.AUTH_MARKET_LEASE_ENVIRONMENT).toLowerCase() + '-' + env.AUTH_MARKET_LEASE_MARKET + '.lock');
  const owner = JSON.parse(fs.readFileSync(path.join(folder, 'owner.json'), 'utf8'));
  const alive = value => { try { process.kill(value, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } };
  if (owner.token !== env.AUTH_MARKET_LEASE || owner.hostname !== os.hostname() || !ownerAlive(folder, owner, alive)) throw busy();
  const member = path.join(folder, 'members', pid + '-' + crypto.randomUUID() + '.json');
  fs.writeFileSync(member, JSON.stringify({pid, token:owner.token}), {flag:'wx', mode:0o600});
  return () => { try { fs.unlinkSync(member); } catch (e) { if (e.code !== 'ENOENT') throw e; } };
}
module.exports = { acquireMarketLease, leaseDirectory, registerLeaseProcess };
