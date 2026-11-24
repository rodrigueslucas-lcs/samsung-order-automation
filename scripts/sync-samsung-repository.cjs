'use strict';

// Operator-only: importing this module and --help never contact a remote.
const {spawnSync} = require('node:child_process');
const readline = require('node:readline/promises');
const BRANCH = 'agent/mx-qst-p1-finish';
const POLICY = Object.freeze({branch: BRANCH, remotes: {
  origin: 'https://github.com/rodrigueslucas-lcs/samsung-order-automation.git',
  samsung: 'https://code.sdsdev.co.kr/lucas-afonso/samsung-smb-qa-automation.git',
}});
class SyncBlocked extends Error { constructor(code) { super(code); this.code = code; } }
const block = code => { throw new SyncBlocked(code); };
const SHA = /^[a-f0-9]{40}$/;

function gitRunner(cwd) {
  const env = {...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never'};
  for (const key of Object.keys(env)) {
    if (/^GIT_TRACE|^GIT_CURL_VERBOSE$/i.test(key)) delete env[key];
    if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) block('GIT_ENVIRONMENT_OVERRIDE');
  }
  return args => {
    const result = spawnSync('git', args, {cwd, env, shell: false, windowsHide: true,
      encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024});
    // Never forward stderr: Git/provider errors can contain credentials or URLs.
    if (result.error) block('GIT_PROCESS_UNAVAILABLE');
    return {status: result.status, output: result.stdout || ''};
  };
}
function checked(git, args, code) {
  const result = git(args);
  if (result.status !== 0) block(code);
  return result.output.trim();
}
function sensitivePath(name) {
  return /(^|\/)(?:AGENTS\.md|\.agents?|\.codex|\.auth|\.env(?:\..*)?|test-results|playwright-report|allure-results|allure-report|blob-report|node_modules)(?:\/|$)/i.test(name)
    || /(?:^|\/)(?:[^/]*\.(?:pem|p12|pfx|key)|id_rsa|id_ed25519|[^/]*(?:session|storage-?state|test-card|credentials|cookies|tokens)[^/]*\.json)$/i.test(name);
}
function sensitiveText(text) {
  if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(text)) return true;
  if (/https?:\/\/[^\s/]+:[^\s/]+@|(?:password|passwd|client_secret|access_token|refresh_token|api_key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i.test(text)) return true;
  // Detect plausible PANs without treating SHA/order identifiers as card data.
  for (const match of text.matchAll(/(?<![\w])([3456](?:[ -]?\d){12,18})(?![\w])/g)) {
    const digits = [...match[1].replace(/[ -]/g, '')].map(Number);
    let sum = 0;
    for (let i = digits.length - 1, alternate = false; i >= 0; i--, alternate = !alternate) {
      let value = digits[i]; if (alternate) { value *= 2; if (value > 9) value -= 9; } sum += value;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}
function inspectChanges(git, source, target) {
  const commits = checked(git, ['rev-list', '--reverse', source, '^' + target], 'HISTORY_UNAVAILABLE').split('\n').filter(Boolean);
  const files = new Set(), scanned = new Set(), rows = [];
  for (const commit of commits) {
    if (!SHA.test(commit)) block('INVALID_COMMIT');
    const message = checked(git, ['show', '-s', '--format=%B', commit], 'COMMIT_UNAVAILABLE');
    if (sensitiveText(message) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) block('SENSITIVE_COMMIT_MESSAGE');
    const changes = checked(git, ['diff-tree', '--root', '-r', '-m', '--no-renames', '--raw', '-z', '--no-commit-id', commit], 'DIFF_UNAVAILABLE').split('\0');
    for (let i = 0; i < changes.length; i++) {
      if (!changes[i]) continue;
      const fields = changes[i].match(/^:(\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) ([A-Z])$/);
      const name = changes[++i];
      if (!fields || !name || /[\x00-\x1f\x7f]/.test(name)) block('UNSUPPORTED_DIFF');
      if (sensitivePath(name)) block('SENSITIVE_PATH');
      files.add(name);
      if (fields[5] === 'D') continue;
      if (!['100644', '100755'].includes(fields[2])) block('NON_REGULAR_FILE_REQUIRES_REVIEW');
      const blob = fields[4];
      if (scanned.has(blob)) continue;
      scanned.add(blob);
      const size = Number(checked(git, ['cat-file', '-s', blob], 'BLOB_UNAVAILABLE'));
      if (!Number.isSafeInteger(size) || size > 1024 * 1024) block('LARGE_FILE_REQUIRES_REVIEW');
      const content = checked(git, ['cat-file', 'blob', blob], 'BLOB_UNAVAILABLE');
      if (content.includes('\0') || content.includes('\ufffd')) block('BINARY_FILE_REQUIRES_REVIEW');
      if (sensitiveText(content)) block('SENSITIVE_CONTENT');
    }
    rows.push({sha: commit, subject: message.split('\n')[0]});
  }
  return {commits: rows, files: [...files].sort()};
}
function localState(git, policy) {
  if (checked(git, ['branch', '--show-current'], 'BRANCH_UNAVAILABLE') !== policy.branch) block('WRONG_BRANCH');
  if (checked(git, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'STATUS_UNAVAILABLE')) block('WORKING_TREE_NOT_CLEAN');
  const head = checked(git, ['rev-parse', 'HEAD'], 'HEAD_UNAVAILABLE');
  if (!SHA.test(head)) block('INVALID_HEAD');
  for (const name of ['origin', 'samsung']) {
    for (const args of [['remote', 'get-url', '--all', name], ['remote', 'get-url', '--push', '--all', name]]) {
      const urls = checked(git, args, 'REMOTE_CONFIGURATION_UNAVAILABLE').split('\n');
      if (urls.length !== 1 || urls[0] !== policy.remotes[name]) block('REMOTE_POLICY_MISMATCH');
    }
    const mirror = git(['config', '--get', 'remote.' + name + '.mirror']);
    if (mirror.status !== 1 && mirror.output.trim() !== 'false') block('MIRROR_CONFIGURATION_FORBIDDEN');
  }
  return head;
}
function remoteSha(git, name, branch) {
  const output = checked(git, ['ls-remote', '--exit-code', '--refs', name, 'refs/heads/' + branch], 'REMOTE_' + name.toUpperCase() + '_UNAVAILABLE');
  const lines = output.split('\n');
  if (lines.length !== 1 || lines[0].split('\t')[1] !== 'refs/heads/' + branch || !SHA.test(lines[0].split('\t')[0])) block('REMOTE_SHA_UNAVAILABLE');
  return lines[0].split('\t')[0];
}

async function runSync({cwd = process.cwd(), policy = POLICY, publish = false, confirm, log = console.log, git = gitRunner(cwd)} = {}) {
  let approved, pushStarted = false;
  try {
    const head = localState(git, policy);
    // No fetch until BOTH remote branch reads have succeeded.
    const source = remoteSha(git, 'origin', policy.branch);
    const target = remoteSha(git, 'samsung', policy.branch);
    if (head !== source) block('HEAD_NOT_PUBLISHED_ON_ORIGIN');
    for (const name of ['origin', 'samsung']) checked(git, ['fetch', '--no-tags', '--no-write-fetch-head', '--refmap=', name, 'refs/heads/' + policy.branch], 'FETCH_FAILED');
    // Detect movement between ls-remote and fetch; never approve stale history.
    if (remoteSha(git, 'origin', policy.branch) !== source || remoteSha(git, 'samsung', policy.branch) !== target) block('REMOTE_CHANGED_DURING_INSPECTION');
    if (source === target) { log('UP_TO_DATE ' + source); return {status: 'UP_TO_DATE', sha: source}; }
    const ancestor = git(['merge-base', '--is-ancestor', target, source]);
    if (ancestor.status !== 0) block(ancestor.status === 1 ? 'HISTORY_DIVERGED_OR_TARGET_AHEAD' : 'HISTORY_UNAVAILABLE');
    const changes = inspectChanges(git, source, target);
    log('Source SHA: ' + source + '\nTarget SHA: ' + target);
    for (const commit of changes.commits) log(commit.sha + ' ' + commit.subject);
    for (const file of changes.files) log('File: ' + file);
    log('Review company sharing policies and every outgoing commit before publication. Automated scanning is conservative and does not replace that review.');
    if (!publish) { log('DRY_RUN: no push. To request publication: npm run git:sync:samsung -- --publish'); return {status: 'DRY_RUN', sha: source, ...changes}; }
    if (typeof confirm !== 'function' || await confirm(source) !== 'PUBLICAR ' + source) block('OPERATOR_APPROVAL_REQUIRED');
    approved = source;
    if (localState(git, policy) !== head) block('LOCAL_STATE_CHANGED_AFTER_APPROVAL');
    if (remoteSha(git, 'origin', policy.branch) !== source || remoteSha(git, 'samsung', policy.branch) !== target) block('REMOTE_CHANGED_AFTER_APPROVAL');
    pushStarted = true;
    const pushed = git(['push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', 'samsung', approved + ':refs/heads/' + policy.branch]);
    // A failed transport may have published; always read back, never retry.
    const actual = remoteSha(git, 'samsung', policy.branch);
    if (actual !== approved) block(pushed.status === 0 ? 'POST_PUSH_SHA_MISMATCH' : 'PUSH_REJECTED_OR_UNCONFIRMED');
    log('SUCCESS: Samsung remote verified at ' + approved);
    return {status: 'SUCCESS', sha: approved, ...changes};
  } catch (error) {
    const code = error instanceof SyncBlocked ? error.code : 'UNEXPECTED_FAILURE';
    const status = pushStarted ? 'UNCONFIRMED' : code.includes('DIVERGED') ? 'DIVERGED' : 'BLOCKED';
    log(status + ': ' + code + (pushStarted ? '; do not retry before reading the remote state.' : '; no push performed.'));
    return {status, code, ...(approved ? {sha: approved} : {})};
  }
}
async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('git:sync:samsung [--dry-run | --publish]\nDefault: diagnostic only, in an authorized Samsung environment.\nPublication requires a clean published branch, history/secret review, company policy approval and typing PUBLICAR <full source SHA>.\nNo force, reset, rebase, credential changes or automatic retry.'); return;
  }
  if (args.length > 1 || args.some(arg => !['--dry-run', '--publish'].includes(arg))) { console.error('BLOCKED: INVALID_ARGUMENTS'); process.exitCode = 1; return; }
  const result = await runSync({publish: args.includes('--publish'), confirm: async sha => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return '';
    const terminal = readline.createInterface({input: process.stdin, output: process.stdout});
    try { return (await terminal.question('After reviewing commits and company sharing policies, type PUBLICAR ' + sha + ': ')).trim(); }
    finally { terminal.close(); }
  }});
  if (!['SUCCESS', 'UP_TO_DATE', 'DRY_RUN'].includes(result.status)) process.exitCode = 1;
}
module.exports = {runSync, inspectChanges, sensitivePath, sensitiveText, POLICY, gitRunner};
if (require.main === module) main(process.argv.slice(2)).catch(() => { console.error('BLOCKED: STARTUP_FAILURE'); process.exitCode = 1; });
