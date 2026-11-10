(function (global, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global.document) global.document.querySelectorAll('[data-smb-home]').forEach(api.mount);
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const markets = ['MX', 'PE', 'CL', 'CO'];
  const labels = { MX: 'MX — México', PE: 'PE — Peru', CL: 'CL — Chile', CO: 'CO — Colômbia' };
  const jobs = [...markets.map(m => 'Samsung-SMB-' + m), ...markets.map(m => 'Samsung-SMB-EPP-' + m), 'SAMSUNG-SMB-AUTOMATION', 'Samsung-SMB-Auth-Operations'];
  const nav = [['Overview', '/'], ['Base Store', '/view/02%20-%20Base%20Store/'], ['EPP', '/view/03%20-%20EPP/'], ['Auth & Ops', '/view/04%20-%20Auth%20and%20Ops/'], ['Quality Summary', '/view/Samsung%20SMB%20Quality%20Summary/'], ['All Jobs', '/view/all/']];
  const results = new Set(['SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT']);
  const reportTypes = ['Quality Dashboard', 'Allure', 'Playwright', 'Regional Summary'];
  function duration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return 'Unavailable';
    const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
    return (hours ? hours + 'h ' : '') + (minutes || hours ? minutes + 'm ' : '') + seconds % 60 + 's';
  }
  function time(ms) { return Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }) : 'Unavailable'; }
  function status(job, queue) {
    if (job.running?.length) return 'RUNNING';
    if (queue.some(q => q.name === job.name)) return 'QUEUED';
    return !job.completed ? 'NOT BUILT' : results.has(job.completed.result) ? job.completed.result.replace('_', ' ') : 'UNKNOWN';
  }
  function metrics(snapshot) {
    return { total: snapshot.jobs.length, running: snapshot.running.length, queued: snapshot.queue.length,
      failed: snapshot.jobs.filter(j => ['FAILURE', 'UNSTABLE'].includes(j.completed?.result)).length,
      base: snapshot.jobs.filter(j => j.store === 'BASE_STORE').length, epp: snapshot.jobs.filter(j => j.store === 'EPP').length };
  }
  function action(job, queue) {
    const prefix = '/job/' + encodeURIComponent(job.name) + '/';
    if (job.running?.length) return { label: 'View running #' + job.running[0].number, path: prefix + job.running[0].number + '/', kind: 'running' };
    if (queue.some(q => q.name === job.name)) return { label: 'Queued · view job', path: prefix, kind: 'queued' };
    if (!job.canBuild) return { label: 'Build unavailable', kind: 'disabled' };
    return { label: job.parameterized ? '▶ Build Now · review parameters' : '▶ Build Now', path: prefix + 'build?delay=0sec', kind: job.parameterized ? 'parameters' : 'native-post' };
  }
  function safeReport(job, report) {
    return reportTypes.includes(report.type) && Number.isSafeInteger(report.build) && report.build > 0
      && new RegExp('^job/' + job.name + '/' + report.build + '/[A-Za-z0-9_.-]+/$').test(report.url);
  }
  function validate(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.observedAt) || !Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.running) || !Array.isArray(snapshot.queue)
      || !snapshot.executors || !['total', 'busy', 'available'].every(k => Number.isFinite(snapshot.executors[k]) && snapshot.executors[k] >= 0)) throw Error('Invalid operations snapshot');
    const names = new Set();
    for (const job of snapshot.jobs) {
      if (!jobs.includes(job.name) || names.has(job.name) || !Array.isArray(job.running) || !Array.isArray(job.reports)) throw Error('Invalid job projection');
      names.add(job.name);
    }
    if (snapshot.queue.some(q => !names.has(q.name)) || snapshot.running.some(q => !names.has(q.name))) throw Error('Invalid execution projection');
    return snapshot;
  }
  function mount(root) {
    if (root.dataset.mounted) return;
    root.dataset.mounted = 'true';
    const document = root.ownerDocument, win = document.defaultView;
    const configuredRoot = new URL(root.dataset.root || '/',win.location.origin);
    if(configuredRoot.origin!==win.location.origin||configuredRoot.search||configuredRoot.hash){root.textContent='Jenkins origin unavailable';return;}
    const base = configuredRoot.pathname.replace(/\/+$/,'');
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
    const anchor = (path, text, cls = 'smb-link') => { const a = el('a', cls, text); a.href = base + path; return a; };
    const header = el('header', 'smb-hero');
    header.append(el('p', 'smb-eyebrow', 'SAMSUNG · LATAM QA ENGINEERING'), el('h1', '', 'Samsung SMB — QA Automation Center'), el('p', 'smb-subtitle', 'LATAM | Base Store & EPP | CI/CD Quality Monitoring'));
    const navigation = el('nav', 'smb-nav'); navigation.setAttribute('aria-label', 'QA Automation navigation');
    nav.forEach(([label, path]) => navigation.append(anchor(path, label, 'smb-nav-link')));
    const toolbar = el('div', 'smb-toolbar'), freshness = el('span', 'smb-freshness', 'Connecting to Jenkins…'), refresh = el('button', 'smb-refresh', 'Refresh status');
    refresh.type = 'button'; freshness.setAttribute('role', 'status'); toolbar.append(freshness, refresh);
    const metricGrid = el('div', 'smb-metrics'), metricNodes = {};
    for (const [key, label, note] of [['total', 'Total QA jobs', 'Visible to your account'], ['running', 'Running builds', 'Current executions'], ['queued', 'Queued builds', 'Waiting for execution'], ['failed', 'Failed / unstable', 'Latest completed results'], ['base', 'Base Store lanes', 'Market-owned campaigns'], ['epp', 'EPP lanes', 'Independent S2 programmes']]) {
      const box = el('div', 'smb-metric'), value = el('strong', 'smb-metric-value', '—'); metricNodes[key] = value;
      box.append(el('span', 'smb-metric-label', label), value, el('span', 'smb-muted', note)); metricGrid.append(box);
    }
    const monitor = el('section', 'smb-monitor'), monitorHead = el('div', 'smb-section-head'), monitorBody = el('div', 'smb-monitor-body'), executor = el('span', 'smb-executors', 'Executor availability unknown');
    monitorHead.append(el('h2', '', 'Live execution'), executor, anchor('/computer/', 'Executors ↗')); monitor.append(monitorHead, monitorBody);
    const cardNodes = new Map(), sections = [];
    for (const [store, title, subtitle] of [['BASE_STORE', 'Base Store', 'Independent market campaigns'], ['EPP', 'EPP', 'S2 programme execution · functional quality is separate from Jenkins status'], ['OPERATIONS', 'Authentication & Operations', 'Session observability and shared automation operations']]) {
      const section = el('section', 'smb-section'), heading = el('div', 'smb-section-head'), grid = el('div', 'smb-cards');
      heading.append(el('h2', '', title), el('span', 'smb-muted', subtitle)); section.append(heading, grid); sections.push(section);
      const list = store === 'BASE_STORE' ? jobs.slice(0, 4) : store === 'EPP' ? jobs.slice(4, 8) : jobs.slice(8);
      for (const name of list) {
        const market = store === 'OPERATIONS' ? '' : name.split('-').at(-1), prefix = '/job/' + name + '/';
        const card = el('article', 'smb-card'); card.dataset.job = name;
        const top = el('div', 'smb-card-top'), titleLink = anchor(prefix, '', 'smb-card-title');
        if (market) { const flag = el('img', 'smb-flag'); flag.src = base + '/plugin/samsung-smb-home/flags/' + market.toLowerCase() + '.svg'; flag.alt = { MX: 'Mexico flag', PE: 'Peru flag', CL: 'Chile flag', CO: 'Colombia flag' }[market]; flag.width = 32; flag.height = 24; titleLink.append(flag, el('span', '', labels[market])); }
        else titleLink.textContent = name === 'Samsung-SMB-Auth-Operations' ? 'Authentication' : 'Automation operations';
        const badge = el('span', 'smb-status', 'UNKNOWN'); top.append(titleLink, badge);
        const context = el('p', 'smb-context', store.replace('_', ' ') + ' · Pending verification'), fields = el('dl', 'smb-fields'), values = {};
        for (const [key, label] of [['latest', 'Latest completed'], ['result', 'Completed result'], ['duration', 'Duration'], ['success', 'Last successful'], ['failure', 'Last failed'], ['started', 'Started · São Paulo']]) {
          const group = el('div', 'smb-field'), value = el('dd', '', '—'); values[key] = value; group.append(el('dt', '', label), value); fields.append(group);
        }
        const active = el('p', 'smb-active', ''), gate = el('p', 'smb-gate', 'Quality Gate: unavailable'), build = el('div', 'smb-build'), links = el('div', 'smb-actions');
        const consoleLink = anchor(prefix + 'lastBuild/console', 'Console'), history = anchor(prefix, 'Build History');
        links.append(consoleLink, history); const reports = el('div', 'smb-reports');
        card.append(top, context, fields, active, gate, build, reports, links); grid.append(card);
        cardNodes.set(name, { card, badge, context, values, active, gate, build, reports, consoleLink, reportsKey: '', actionKey: '', prefix });
      }
    }
    const foot = el('footer', 'smb-footer'); foot.append(el('span', '', 'Jenkins SUCCESS ≠ every QA test PASS. Known Defects, Auth Blocked, Data Required and Reconciliation remain separate.'), anchor('/view/Samsung%20SMB%20Quality%20Summary/', 'Quality Summary ↗'));
    root.replaceChildren(header, navigation, toolbar, metricGrid, monitor, ...sections, foot);
    let last = null, timer = null, controller = null, failures = 0, stopped = false, pendingBuild = new Set();
    function setValue(node, text) { if (node.textContent !== text) node.textContent = text; }
    function update(snapshot) {
      const counts = metrics(snapshot); for (const [key, node] of Object.entries(metricNodes)) setValue(node, String(counts[key]));
      setValue(executor, snapshot.executors.available + ' / ' + snapshot.executors.total + ' executors available · ' + snapshot.executors.busy + ' busy');
      // The live monitor is passive; no interactive control is discarded on a poll.
      const items = [];
      for (const item of snapshot.running) { const line = el('div', 'smb-live-row'); line.append(el('span', 'smb-status is-running', 'RUNNING'), anchor('/job/' + item.name + '/' + item.run.number + '/', item.name + ' · #' + item.run.number), el('span', 'smb-muted', 'Elapsed ' + duration(item.run.elapsed))); items.push(line); }
      for (const item of snapshot.queue) { const line = el('div', 'smb-live-row'); line.append(el('span', 'smb-status is-queued', 'QUEUED'), anchor('/job/' + item.name + '/', item.name), el('span', 'smb-muted', 'Waiting ' + duration(snapshot.observedAt - item.since))); items.push(line); }
      const monitorKey = JSON.stringify(snapshot.running.map(i => [i.name, i.run.number]).concat(snapshot.queue.map(i => [i.name, i.id])));
      if (monitorBody.dataset.key !== monitorKey || !items.length) { monitorBody.replaceChildren(...(items.length ? items : [el('p', 'smb-empty', 'No tracked builds running or queued.')])); monitorBody.dataset.key = monitorKey; }
      else monitorBody.querySelectorAll('.smb-live-row .smb-muted').forEach((node, index) => setValue(node, items[index].lastChild.textContent));
      const visible = new Set(snapshot.jobs.map(j => j.name));
      for (const [name, c] of cardNodes) { c.card.hidden = !visible.has(name); }
      for (const job of snapshot.jobs) {
        const c = cardNodes.get(job.name), current = status(job, snapshot.queue), run = job.completed;
        c.badge.className = 'smb-status is-' + current.toLowerCase().replaceAll(' ', '-'); setValue(c.badge, current);
        setValue(c.context, job.store.replace('_', ' ') + ' · ' + job.environment + (job.program ? ' · ' + job.program : job.store === 'BASE_STORE' && job.environmentSource ? ' · ' + job.environmentSource : ''));
        setValue(c.values.latest, run ? '#' + run.number : 'None'); setValue(c.values.result, run?.result?.replace('_', ' ') || 'NOT BUILT'); setValue(c.values.duration, run ? duration(run.duration) : '—');
        for (const [key, item] of [['success', job.lastSuccess], ['failure', job.lastFailure]]) {
          const keyValue = item ? '#' + item.number : 'None';
          if (c.values[key].textContent !== keyValue) c.values[key].replaceChildren(...(item ? [anchor(c.prefix + item.number + '/', keyValue)] : [document.createTextNode('None')]));
        }
        const active = job.running[0]; setValue(c.values.started, active ? time(active.startedAt) : run ? time(run.startedAt) : '—');
        setValue(c.active, active ? 'Running #' + active.number + ' · elapsed ' + duration(active.elapsed) : ''); c.active.hidden = !active;
        setValue(c.gate, job.store === 'OPERATIONS' ? 'Session health is separate from functional test results.' : job.qualityGate ? 'Quality Gate · #' + job.qualityGate.build + ': ' + job.qualityGate.label : 'Quality Gate: unavailable · open the published report');
        const reportList = job.reports.filter(r => safeReport(job, r)), reportKey = JSON.stringify([reportList,job.authDashboardAvailable]);
        if (c.reportsKey !== reportKey || !c.reports.childNodes.length) {
          c.reports.replaceChildren();
          if (job.name === 'Samsung-SMB-Auth-Operations') c.reports.append(job.authDashboardAvailable ? anchor('/userContent/samsung-smb-auth/s2/index.html', 'Live Auth Dashboard ↗') : el('span','smb-unavailable','Live Auth Dashboard unavailable'));
          else for (const type of reportTypes) { const r = reportList.find(r => r.type === type); if (r) c.reports.append(anchor('/' + r.url, type + ' · #' + r.build)); else if (type !== 'Regional Summary') c.reports.append(el('span', 'smb-unavailable', type + ' unavailable')); }
          c.reportsKey = reportKey;
        }
        const lastBuild = active || run; c.consoleLink.href = base + c.prefix + (lastBuild ? lastBuild.number + '/' : '') + 'console'; c.consoleLink.hidden = !lastBuild;
        if (['RUNNING', 'QUEUED'].includes(current)) pendingBuild.delete(job.name);
        const buildAction = action(job, snapshot.queue), actionKey = JSON.stringify(buildAction);
        if (c.actionKey !== actionKey) {
          c.build.replaceChildren(); c.actionKey = actionKey;
          if (buildAction.kind === 'native-post') {
            const button = el('button', 'smb-build-button', buildAction.label); button.type = 'button';
            button.addEventListener('click', async () => {
              if (pendingBuild.has(job.name)) return; pendingBuild.add(job.name); button.disabled = true; setValue(button, 'Opening native build…');
              try {
                const response = await win.fetch(base + '/crumbIssuer/api/json', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
                if (!response.ok) throw Error('CSRF unavailable'); const crumb = await response.json();
                if (!/^[A-Za-z0-9-]+$/.test(crumb.crumbRequestField || '') || typeof crumb.crumb !== 'string' || !crumb.crumb) throw Error('Invalid CSRF');
                const form = el('form', ''), input = el('input', ''); form.method = 'POST'; form.action = base + buildAction.path; form.target = '_blank'; input.type = 'hidden'; input.name = crumb.crumbRequestField; input.value = crumb.crumb; form.append(input); c.build.append(form); form.submit(); form.remove(); setValue(button, 'Request sent · review native response'); schedule(1000);
              } catch { pendingBuild.delete(job.name); button.disabled = false; setValue(button, 'Retry native Build Now'); setValue(freshness, 'Build was not requested: native CSRF flow unavailable.'); }
            }); c.build.append(button);
          } else if (buildAction.path) c.build.append(anchor(buildAction.path, buildAction.label, 'smb-build-button' + (['queued', 'running'].includes(buildAction.kind) ? ' smb-build-secondary' : '')));
          else { const unavailable = el('button', 'smb-build-button', buildAction.label); unavailable.disabled = true; c.build.append(unavailable); }
        }
      }
    }
    function schedule(delay) { win.clearTimeout(timer); if (!stopped && !document.hidden) timer = win.setTimeout(poll, delay); }
    async function poll() {
      if (controller || stopped || document.hidden) return;
      controller = new win.AbortController(); refresh.disabled = true;
      const timeout = win.setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await win.fetch(base + '/samsung-smb-home/snapshot', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) throw Error('Jenkins unavailable');
        const snapshot = validate(await response.json());
        if (Math.abs(Date.now() - snapshot.observedAt) > 60000) throw Error('Snapshot stale');
        const scroll = {x:win.scrollX,y:win.scrollY}; update(snapshot); win.scrollTo(scroll.x,scroll.y);
        last = snapshot; failures = 0; root.classList.remove('smb-stale');
        setValue(freshness, 'LIVE · Verified ' + time(snapshot.observedAt) + ' · updates every 15s');
      } catch {
        failures++; root.classList.add('smb-stale'); setValue(freshness, last ? 'STALE · Last verified ' + time(last.observedAt) + ' · retrying safely' : 'UNAVAILABLE · Jenkins data could not be verified');
      } finally {
        win.clearTimeout(timeout); controller = null; refresh.disabled = false; schedule(Math.min(120000, 15000 * Math.pow(2, Math.min(failures, 3))));
      }
    }
    refresh.addEventListener('click', () => { win.clearTimeout(timer); poll(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { win.clearTimeout(timer); controller?.abort(); } else poll(); });
    win.addEventListener('pagehide', () => { stopped = true; win.clearTimeout(timer); controller?.abort(); }, { once: true });
    win.addEventListener('pageshow', () => { if(stopped){stopped=false;poll();} });
    poll();
  }
  return { jobs, labels, nav, duration, time, status, metrics, action, safeReport, validate, mount };
});
