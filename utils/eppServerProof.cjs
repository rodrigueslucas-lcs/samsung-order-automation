function isRegisteredUser(user, expectedEmail) {
  if (!user || typeof user.uid !== "string" || !user.uid.trim() || /^(?:anonymous|guest)(?:$|[-_:])/i.test(user.uid)) return false;
  if (!expectedEmail) return true;
  const expected = expectedEmail.trim().toLowerCase();
  return [user.uid, user.email].some(value => typeof value === "string" && value.trim().toLowerCase() === expected);
}

function watchEppServerProof(context, config, { expectedEmail, bodyTimeoutMs = 15000 } = {}) {
  if (!Number.isFinite(bodyTimeoutMs) || bodyTimeoutMs <= 0) throw new Error('EPP proof read deadline must be positive.');
  const sites = new Set(config.rootUrl.pathname.split("/").filter(Boolean).slice(2, 4).map(site => site.toLowerCase()));
  const apiHost = config.environment === 'S1' ? 's1-smb-api-cdn.ecom-stg.samsung.com' : 's2-smb-api-cdn.ecom-stg.samsung.com';
  const state = { user: false, access: false };
  const reasons = { user: "SERVER_PROOF_PENDING", access: "SERVER_PROOF_PENDING" };
  let serial = 0;
  const latest = { user: 0, access: 0 };
  const pending = new Set();
  const listener = response => {
    let url, match;
    try {
      url = new URL(response.url());
      match = url.pathname.match(/^\/tokocommercewebservices\/v2\/([^/]+)\/users\/current(\/checkAccess)?\/?$/);
      if (!match || !sites.has(match[1].toLowerCase()) || response.request().method() !== "GET" ||
          !(url.origin === config.rootUrl.origin || (url.protocol === 'https:' && url.hostname === apiHost && !url.port))) return;
    } catch { return; }
    const kind = match[2] ? "access" : "user";
    const sequence = ++serial;
    latest[kind] = sequence;
    const task = (async () => {
      const status = response.status();
      let accepted = false, reason;
      if (status === 401 || status === 403) reason = "SERVER_AUTH_REJECTED";
      else if (status >= 500) reason = "SERVER_UNAVAILABLE";
      else if (status !== 200) reason = "SERVER_PROOF_UNEXPECTED_STATUS";
      else {
        let timer;
        try {
          const payload = await Promise.race([
            response.json(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('EPP proof body did not finish.'), { code: 'EPP_PROOF_BODY_TIMEOUT' })), bodyTimeoutMs); }),
          ]);
          accepted = kind === "user" ? isRegisteredUser(payload, expectedEmail) : payload?.canAccess === true;
          reason = accepted ? "SERVER_ACCEPTED" : kind === "user" ? "SERVER_IDENTITY_NOT_PROVEN" : "EPP_ENTITLEMENT_NOT_PROVEN";
        } catch (error) { reason = error.code === 'EPP_PROOF_BODY_TIMEOUT' ? 'SERVER_PROOF_BODY_TIMEOUT' : 'SERVER_PROOF_INVALID_PAYLOAD'; }
        finally { clearTimeout(timer); }
      }
      if (latest[kind] === sequence) { state[kind] = accepted; reasons[kind] = reason; }
    })().catch(() => { if (latest[kind] === sequence) { state[kind] = false; reasons[kind] = "SERVER_PROOF_UNAVAILABLE"; } });
    pending.add(task);
    task.finally(() => pending.delete(task));
  };
  context.on("response", listener);
  return {
    accepted: () => state.user && state.access,
    snapshot: () => ({ userAccepted: state.user, accessAccepted: state.access, reason: state.user && state.access ? "SERVER_ACCEPTED" : !state.user ? reasons.user : reasons.access }),
    settle: () => Promise.allSettled([...pending]),
    stop: () => context.off("response", listener),
  };
}

module.exports = { isRegisteredUser, watchEppServerProof };
