const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { zipSync, strToU8 } = require('fflate');
const { startDstCdpTrace } = require('../../utils/dstCdpTrace.cjs');

async function fixture(entries, action) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dst-trace-contract-'));
  const events = [], annotations = [];
  const info = { annotations, outputPath: name => path.join(root, name),
    attach: async (name, data) => { assert.equal(name, 'trace'); assert.equal(data.contentType, 'application/zip'); events.push('attach'); } };
  const context = { tracing: { start: async options => { assert.deepEqual(options, { screenshots:true, snapshots:true, sources:true }); events.push('start'); },
    stop: async options => { events.push('stop'); await fs.writeFile(options.path, zipSync(entries)); } } };
  try { await action({context, info, events, annotations}); }
  finally { await fs.rm(root, { recursive:true, force:true }); }
}

test('CDP archive requires real browser trace/network and attaches only a validated ZIP', async () => {
  await fixture({'trace.trace':strToU8('{"type":"context-options"}\n'), 'trace.network':strToU8('')}, async ({context,info,events,annotations}) => {
    const finish = await startDstCdpTrace(context, info);
    assert.deepEqual(events, ['start']);
    await finish();
    assert.deepEqual(events, ['start','stop','attach']);
    const proof = JSON.parse(annotations[0].description);
    assert.equal(proof.capture, 'PUBLIC_CONTEXT_TRACING_BEFORE_DISCONNECT');
    assert.match(proof.sha256, /^[a-f0-9]{64}$/);
    assert.ok(proof.bytes > 0);
  });
});

for (const entries of [{'test.trace':strToU8('test only')}, {'trace.trace':strToU8('browser without network')}]) {
  test('test-only or incomplete archives fail instead of silently disabling tracing: '+Object.keys(entries)[0], async () => {
    await fixture(entries, async ({context,info,events}) => {
      const finish = await startDstCdpTrace(context, info);
      await assert.rejects(finish, /DST_CDP_TRACE_INVALID/);
      assert.deepEqual(events, ['start','stop']);
    });
  });
}

function flowFixture() {
  const events = [], context = {};
  const page = {context:()=>context, on(){}, bringToFront:async()=>{}, route:async()=>{}, url:()=> 'about:blank', close:async()=>events.push('page-close')};
  const browser = {contexts:()=>[context],close:async()=>events.push('disconnect')};
  const sandbox = {module:{exports:{}}, process:{env:{}}, URL, chromium:{connectOverCDP:async()=>browser},
    evidenceContext:{recordBusinessEvidence(){}}, preQaCustomerState:{preparePreQaCustomerPage:async()=>page},
    bcCareChoice:{resolveMxBcCareChoice(){}}, bcCatalog:{}, bcVariant:{}, test:{}, expect(){} };
  return fs.readFile(path.join(__dirname,'../../flows/mx/bcAddToCart.js'),'utf8').then(source=>{
    vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace('export async function','async function')+'\nmodule.exports={addMxBcProductToCart};',sandbox);
    return {run:sandbox.module.exports.addMxBcProductToCart,events};
  });
}

test('BC captures the business failure then flushes trace before page close and disconnect', async () => {
  const {run,events} = await flowFixture(); const business = Error('DST_BC_COLOUR_NOT_RENDERED');
  await assert.rejects(run({}, {preparePage:async()=>{events.push('business');throw business;},startTrace:async()=>async()=>events.push('trace-stop')}), error=>error===business);
  assert.deepEqual(events,['business','trace-stop','page-close','disconnect']);
});

test('simultaneous business and archive failures remain visible and still release the owned page', async () => {
  const {run,events} = await flowFixture(); const business=Error('business'), archive=Error('archive');
  await assert.rejects(run({}, {preparePage:async()=>{throw business;},startTrace:async()=>async()=>{events.push('trace-stop');throw archive;}}), error=>{
    assert.equal(error.errors[0],business); assert.equal(error.errors[1],archive); return true;
  });
  assert.deepEqual(events,['trace-stop','page-close','disconnect']);
});

test('QST callers without a trace hook keep their original failure and cleanup behaviour', async () => {
  const {run,events} = await flowFixture();const business=Error('original QST error');
  await assert.rejects(run({}, {preparePage:async()=>{throw business;}}), error=>error===business);
  assert.deepEqual(events,['page-close','disconnect']);
});
