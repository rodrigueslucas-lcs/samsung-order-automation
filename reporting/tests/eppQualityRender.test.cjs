const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {render,evidenceHref}=require('../epp-quality/render.cjs');
test('current causal order is presented once with its payment and confirmation scenarios',()=>{
 const html=render({market:'CL',environment:'S2',program:'alianzas',runId:'current',gate:'FULLY PASSED',executed:2,official:7,counts:{PASS:2},rows:[],orders:[{publicOrderNumber:'CL261104-78817132',method:'card',tcs:['SAM-24864','SAM-24866'],newOrderInCurrentRun:true,confirmationValidated:true}]},{artifactRoot:process.cwd()});
 assert.equal(html.split('CL261104-78817132').length-1,1);
 assert.match(html,/SAM-24864, SAM-24866/);
 assert.match(html,/Current run · confirmation validated/);
});
test('no causal order renders an explicit absence rather than a historical payment success',()=>{
 const html=render({market:'CL',environment:'S2',program:'alianzas',runId:'current',gate:'NOT_RUN',executed:0,official:7,counts:{NOT_RUN:7},rows:[]},{artifactRoot:process.cwd()});
 assert.match(html,/No newly confirmed order proven/);
 assert.match(html,/Historical reconciliation does not count/);
});
test('only evidence inside current artifact root is linked',()=>{const root=path.resolve('test-results/epp/current');assert.equal(evidenceHref(root,path.join(root,'playwright','evidence one.png')),'../playwright/evidence%20one.png');assert.equal(evidenceHref(root,path.resolve('playwright/.auth/state.json')),null);assert.equal(evidenceHref(root,'https://external.test'),null);});
test('responsive renderer preserves raw/business distinction and escapes content',()=>{const html=render({market:'CL',environment:'S2',program:'alianzas',runId:'build-1',buildNumber:1,gate:'PASSED WITH KNOWN DEFECTS',executed:1,official:1,counts:{PASS:0,KNOWN_DEFECT:1},rows:[{tc:'SAM-24841',name:'<script>alert(1)</script>',raw:'skipped',quality:'KNOWN_DEFECT',duration:0,reference:'SAM-25146',url:'https://jira.secext.samsung.net/browse/SAM-25146',evidence:[]}]},{artifactRoot:process.cwd()});assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/>skipped</);assert.match(html,/name="viewport"/);assert.match(html,/overflow-x:auto/);assert.match(html,/Known defects do not count as PASS/);});


test('EPP dashboard exposes executive sections without changing raw and QA status',()=>{
 const html=render({market:'CO',environment:'S2',program:'co_epp_agre',runId:'build-3',buildNumber:3,
  gate:'TARGETED PASSED',executed:1,official:6,targetIds:['SAM-24942'],selected:1,
  counts:{PASS:1,NOT_RUN:5},rows:[{tc:'SAM-24942',name:'Contact Details Section',raw:'passed',quality:'PASS',duration:53800,evidence:[]},
   {tc:'SAM-24952',name:'Official scenario',raw:null,quality:'NOT_RUN',duration:0,evidence:[]}],orders:[]},{artifactRoot:process.cwd()});
 for(const text of ['epp-theme.css','Executive overview','Execution summary','Official test execution matrix','Payment traceability','Targeted execution','1 / 6 executed','5 official scenarios not executed'])assert.ok(html.includes(text),text);
 assert.match(html,/epp-pill--pass">PASS|epp-pill--pass">Passed/);
 assert.match(html,/epp-row--notrun/);
 assert.match(html,/Only a complete current official campaign can be FULLY PASSED/);
});
test('EPP dashboard does not render executable HTML or hostile links from scenario data',()=>{
 const html=render({market:'CL',environment:'S2',program:'alianzas',runId:'run',gate:'FAILED — NEW REGRESSION',official:1,executed:1,
  counts:{FAIL:1},rows:[{tc:'SAM-24841',name:'<img src=x onerror=alert(1)>',raw:'failed',quality:'FAIL',duration:0,
    url:'javascript:alert(1)',reference:'SAM-25146',errorSummary:'<script>bad</script>',evidence:[]}]},{artifactRoot:process.cwd()});
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('&lt;script&gt;bad'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(!html.includes('href="javascript:'));
});

test('EPP V2 shows native flag, homologation readiness and known issue without rewriting raw results',()=>{
 const model={market:'MX',environment:'S2',program:'pymesmx',runId:'v2',gate:'FAILED — NEW REGRESSION',official:7,executed:6,
  counts:{PASS:5,FAIL:1,KNOWN_DEFECT:1},rows:[
   {tc:'SAM-25020',name:'SAM-25020 @qst @mx @epp @safe - Variants/selectors on PDP',raw:'failed',quality:'FAIL',duration:1000,evidence:[]},
   {tc:'SAM-25046',name:'SAM-25046 @preflight - Pay in Cash',raw:'skipped',quality:'KNOWN_DEFECT',duration:0,
    reference:'RT-779284',url:'https://jira.secext.samsung.net/browse/RT-779284',reasonCode:'MX_EPP_CASH_TRANSACTION_FAILED',evidence:[]}],orders:[]};
 const html=render(model,{artifactRoot:process.cwd()});
 assert.match(html,/🇲🇽 MX/);
 assert.match(html,/Homologation readiness/);
 assert.match(html,/Not fully homologated/);
 assert.match(html,/Known defects & dependencies/);
 assert.match(html,/RT-779284/);
 assert.match(html,/Variants\/selectors on PDP/);
 assert.doesNotMatch(html,/<span class="epp-scenario"[^>]*>SAM-25020 @qst/);
 assert.match(html,/epp-pill--fail">failed/);
 assert.match(html,/epp-pill--warn">Known defect/);
});
test('EPP V2 collapses multiple evidence actions without losing verified attachment links',()=>{
 const root=path.resolve('test-results/epp/current');
 const model={market:'CL',environment:'S2',program:'alianzas',runId:'one',gate:'TARGETED PASSED',official:1,executed:1,
 counts:{PASS:1},rows:[{tc:'SAM-24864',name:'Payment',raw:'passed',quality:'PASS',duration:200,
 evidence:[1,2,3,4].map(n=>({name:'shot '+n,path:path.join(root,'playwright','proof-'+n+'.png')}))}]};
 const html=render(model,{artifactRoot:root});
 assert.match(html,/\+2 more/);
 for(let n=1;n<=4;n++)assert.match(html,new RegExp('proof-'+n+'\\.png'));
 assert.match(html,/epp-evidence-link--allure/);
});
