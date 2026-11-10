const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRun, executeRun } = require("../../scripts/run-epp-qst.cjs");
const { buildMatrix } = require("../../scripts/discover-epp-access.cjs");

test('normal runtime prints typed current-run PASS/BLOCKED reasons without raw secrets; discovery never reads results',()=>{
 const {summarizeRun}=require('../../scripts/run-epp-qst.cjs'),lines=[];
 const document={suites:[{specs:[{title:'SAM-25020 test',tests:[{annotations:[{type:'skip',description:'AUTH_OR_ENTITLEMENT_REQUIRED private-token-fixture'}],results:[{status:'skipped'}]}]},{title:'SAM-25021 test',tests:[{results:[{status:'passed'}]}]}]}]};
 const rows=summarizeRun({command:[],output:'fixture'},{io:{existsSync:()=>true,readFileSync:()=>JSON.stringify(document)},log:s=>lines.push(s)});
 assert.equal(rows.length,2);assert.match(lines[0],/SAM-25020 · BLOCKED · AUTH_OR_ENTITLEMENT_REQUIRED/);assert.match(lines[1],/SAM-25021 · PASS/);assert.ok(!lines.join('').includes('private-token'));
 assert.deepEqual(summarizeRun({command:['--list']},{io:{existsSync:()=>assert.fail('discovery cannot inspect runtime')},log:()=>assert.fail('unexpected log')}),[]);
});
test('terminal summary displays the associated Jira without relabeling an unmatched prerequisite as PASS or known defect',()=>{
 const {summarizeRun}=require('../../scripts/run-epp-qst.cjs'),lines=[];
 const document={config:{metadata:{epp:{market:'CO',environment:'S2'}}},suites:[{specs:[{title:'SAM-24952 test',tests:[{annotations:[{type:'skip',description:'MASS_REQUIRED: no tooltip trigger'}],results:[{status:'skipped'}]}]}]}]};
 const rows=summarizeRun({command:[],output:'fixture'},{io:{existsSync:()=>true,readFileSync:()=>JSON.stringify(document)},log:s=>lines.push(s)});
 assert.equal(rows[0].result,'BLOCKED');assert.match(lines[0],/associated issue: RT-746043/);assert.doesNotMatch(lines[0],/PASS|KNOWN_DEFECT/);
});

test("EPP list discovery acquires no identity lock", () => {
  assert.equal(executeRun(buildRun("PE", ["--list"], {}), {
    acquire: () => { throw new Error("must not acquire"); }, spawn: () => ({ status: 0 }),
  }), 0);
});
for (const failure of [false, true]) test(`EPP campaign releases its own lease after ${failure ? "launch error" : "worker failure"}`, () => {
  let released = 0;
  const options = {
    acquire: config => { assert.equal(config.market, "CO"); return { env: { EPP_LEASE_TOKEN: "synthetic-lease" }, release: () => released++ }; },
    spawn: (_, __, options) => { assert.equal(options.env.EPP_LEASE_TOKEN, "synthetic-lease"); if (failure) throw new Error("fixture launch error"); return { status: 1 }; },
  };
  if (failure) assert.throws(() => executeRun(buildRun("CO", [], {}), options), /fixture launch error/);
  else assert.equal(executeRun(buildRun("CO", [], {}), options), 1);
  assert.equal(released, 1);
});
test("busy EPP identity never launches a competing campaign", () => {
  assert.throws(() => executeRun(buildRun("MX", [], {}), {
    acquire: () => { throw Object.assign(new Error("BUSY"), { code: "AUTH_BUSY" }); },
    spawn: () => { assert.fail("competing browser launched"); },
  }), /BUSY/);
});
for (const [market, count] of [["MX", 7], ["CO", 6], ["PE", 6], ["CL", 7]]) {
  test(`${market} EPP runner owns exactly ${count} official cases in both staging environments`, () => {
    for (const environment of ["S1", "S2"]) {
      const run = buildRun(market, ["--list"], { ENVIRONMENT: environment, MX_QST_TARGET_IDS: market === "MX" ? "SAM-25021" : "SAM-foreign" });
      assert.equal(run.ids.length, count);
      assert.equal(run.env.TEST_STORE, "EPP");
      assert.equal(run.env.ENVIRONMENT, environment);
      assert.ok(run.command.includes("--config=playwright.epp.config.js"));
      assert.ok(run.command.includes("--list"));
      assert.ok(run.command.includes(`tests/markets/${market.toLowerCase()}/qst/epp/`));
      if (market !== "MX") assert.equal(run.env.MX_QST_TARGET_IDS, undefined);
    }
  });
}
test("foreign SAMs and unsupported flags are rejected before launching a browser", () => {
  assert.throws(() => buildRun("PE", [], { PE_QST_TARGET_IDS: "SAM-25021" }), /outside/);
  assert.throws(() => buildRun("PE", ["--retries=2"], {}), /Unsupported/);
});
test("access discovery never converts observed gates into functional TC PASS", () => {
  const access = ["MX", "CO", "PE", "CL"].flatMap(market => ["S1", "S2"].map(environment => ({ market, environment, status: "READY", reason: "ACCESS_ONLY" })));
  const matrix = buildMatrix(access);
  assert.equal(matrix.length, 52);
  assert.equal(new Set(matrix.map(row => `${row.market}:${row.environment}:${row.tc}`)).size, 52);
  assert.ok(matrix.every(row => row.runtime === "NOT_RUN" && row.result === "NOT_RUN"));
});
test('proven ignored product mass reaches the child through validated market overrides',()=>{
  const run=buildRun('CL',[],{ENVIRONMENT:'S1'},{readData:cfg=>{assert.equal(cfg.market,'CL');assert.equal(cfg.environment,'S1');return{product:{sku:'QA-SKU',pdpUrl:'https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/p/QA-SKU'}};}});
  assert.equal(run.env.CL_EPP_QST_SKU,'QA-SKU');
  assert.equal(run.env.CL_EPP_QST_PDP_URL,'https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/p/QA-SKU');
  assert.throws(()=>buildRun('CL',[],{ENVIRONMENT:'S1'},{readData:()=>({product:{sku:'QA',pdpUrl:'https://www.samsung.com/cl/p/QA'}})}),/configured staging multistore/);
});
test('listing ignores private fixtures and explicit product overrides retain precedence',()=>{
  const fixture={product:{sku:'ignored',pdpUrl:'invalid'}};
  const list=buildRun('CL',['--list'],{ENVIRONMENT:'S1'},{readData:()=>{throw Error('listing must not read private fixtures');}});
  assert.equal(list.env.CL_EPP_QST_SKU,undefined);
  const run=buildRun('CL',[],{ENVIRONMENT:'S1',CL_EPP_QST_SKU:'explicit',CL_EPP_QST_PDP_URL:'https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/p/explicit'},{readData:()=>fixture});
  assert.equal(run.env.CL_EPP_QST_SKU,'explicit');
});


test('CL S2 retains all seven scenarios and permits only registered transfer-defect quarantine',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const spec=fs.readFileSync(path.resolve(__dirname,'../../tests/markets/cl/qst/epp/official-p1.spec.js'),'utf8');
 // SAM-24865 has an evidence-backed registered application defect. It must not
 // turn into a blanket skip, nor prevent the other six scenarios from running.
 const registeredTransfer=/const quarantine=await paymentDefect\.attachRegisteredPaymentDefect\(current,'SAM-24865',test\.info\(\)\);\s*if\(quarantine\)test\.skip\(true,quarantine\);/g;
 assert.equal([...spec.matchAll(registeredTransfer)].length,1);
 assert.equal(spec.replace(registeredTransfer,'').includes('test.skip('),false);
 for(const id of ['SAM-24836','SAM-24840','SAM-24841','SAM-24851','SAM-24864','SAM-24865','SAM-24866'])assert.ok(spec.includes(id));
});
test('CL S2 strict checkout gates do not enable payments by default',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 for(const file of ['flows/eppStorefront.js','flows/eppPaymentPrerequisites.js']){
   const source=fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8');
   assert.ok(source.includes("cfg?.market === 'CL' && cfg.environment === 'S2'"));
   assert.ok(source.includes('throw new Error(reason)'));
 }
 const run=buildRun('CL',[],{CL_QST_ENVIRONMENT:'S2',BROWSER_MODE:'headed',ALLOW_PAYMENT_SUBMIT:'1'},{readData:()=>null});
 assert.equal(run.env.ALLOW_PAYMENT_SUBMIT,'1');
 assert.equal(run.env.BROWSER_MODE,'headed');
 assert.equal(run.env.ENVIRONMENT,'S2');
 assert.equal(run.env.TEST_STORE,'EPP');
 const defaultRun=buildRun('CL',[],{CL_QST_ENVIRONMENT:'S2'},{readData:()=>null});
 assert.notEqual(defaultRun.env.ALLOW_PAYMENT_SUBMIT,'1');
});

test('runtime BUSY is explicit and does not expose sensitive exception details',()=>{
 const {classifyRunFailure}=require('../../scripts/run-epp-qst.cjs');
 assert.equal(classifyRunFailure({code:'AUTH_BUSY',message:'private token fixture'}).exitCode,73);
 assert.match(classifyRunFailure({code:'AUTH_BUSY'}).message,/BUSY/);
 assert.equal(classifyRunFailure({message:'private token fixture'}).exitCode,1);
 assert.ok(!JSON.stringify(classifyRunFailure({code:'AUTH_BUSY',message:'private token fixture'})).includes('private'));
});
