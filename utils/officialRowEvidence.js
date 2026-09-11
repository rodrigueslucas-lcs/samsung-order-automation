const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const preqa2 = require("../test-mapping/preqa2-validation.json");
const mxS1Runtime = require("../test-mapping/mx-s1-qst-runtime.json");
const { collectMarketImplementation } = require("./qstS1Implementation");

const MX_P1_LEGACY_LINKS = Object.freeze({
  BASE_STORE: { 2:"SAM-24962",3:"SAM-24963",4:"SAM-24964",8:"SAM-24968",9:"SAM-24969",11:"SAM-24971",12:"SAM-24972",15:"SAM-24975",21:"SAM-24981",22:"SAM-24982",25:"SAM-24985",26:"SAM-24986",28:"SAM-24988",29:"SAM-24989",30:"SAM-24990",31:"SAM-24991",32:"SAM-24992",33:"SAM-24993",34:"SAM-24994",35:"SAM-24995",39:"SAM-24999",40:"SAM-25000",41:"SAM-25001",42:"SAM-25002",44:"SAM-25004",45:"SAM-25005",46:"SAM-25006",50:"SAM-25010",51:"SAM-25011",56:"SAM-25016" },
  EPP: { 4:"SAM-25020",5:"SAM-25021",6:"SAM-25022",18:"SAM-25034",28:"SAM-25044",29:"SAM-25045",30:"SAM-25046" },
});
const OTHER_PROVEN_LINKS = Object.freeze({
  PE: { BASE_STORE: { 2:"SAM-25055",3:"SAM-25056",4:"SAM-25057",8:"SAM-25061",9:"SAM-25062",11:"SAM-25064",12:"SAM-25065",15:"SAM-25068",21:"SAM-25074",22:"SAM-25075",23:"SAM-25076",26:"SAM-25079",28:"SAM-25081",31:"SAM-25084",32:"SAM-25085",33:"SAM-25086",34:"SAM-25087",35:"SAM-25088",36:"SAM-25089",37:"SAM-25090",41:"SAM-25094",42:"SAM-25099",46:"SAM-25103",47:"SAM-25104",52:"SAM-25095",53:"SAM-25096",54:"SAM-25097" }, EPP: { 1:"SAM-25109",5:"SAM-25113",6:"SAM-25114",17:"SAM-25125",30:"SAM-25138" } },
  CL: { BASE_STORE: { 48:"SAM-24830" }, EPP: {} },
  CO: { BASE_STORE: { 45:"SAM-24920" }, EPP: {} },
});

function attachOtherMarketEvidence(market, context, row) {
  if (row.priority !== "P1") return row;
  const officialId = OTHER_PROVEN_LINKS[market]?.[context]?.[row.sourceSerial];
  if (!officialId) return row;
  const implementation = collectMarketImplementation(market).find(({ id }) => id === officialId);
  return { ...row, officialId, coverage: implementation ? "partial" : "missing", implemented: Boolean(implementation), implementation: implementation?.spec || null, environmentRequired: context === "EPP" ? "EPP_CONTEXT" : "S1", runtime: { status: "NOT_RUN" }, blocker: implementation ? "Implementation exists but the complete current official requirement has not been runtime-proven." : null };
}

function attachKnownEvidence(market, context, row) {
  if (market !== "MX") return attachOtherMarketEvidence(market, context, row);
  if (row.priority !== "P1") return row;
  const officialId = MX_P1_LEGACY_LINKS[context][row.sourceSerial];
  if (!officialId) return { ...row, coverage: "missing", implemented: false, runtime: { status: "NOT_RUN" }, blocker: "No proven legacy Samsung ID or implementation maps to this current official row." };
  const coverage = mxCoverage.cases[officialId];
  const runtime = preqa2.markets.MX.results[officialId];
  const stagingRequired = context !== "EPP" && runtime?.status === "NOT_APPLICABLE";
  const stagingRuntime = stagingRequired ? mxS1Runtime.results[officialId] : null;
  const runtimeStatus = stagingRequired ? stagingRuntime?.status || "NOT_RUN" : runtime?.status || "NOT_RUN";
  return {
    ...row,
    officialId,
    coverage: coverage?.coverage || "missing",
    implemented: Boolean(coverage?.spec),
    implementation: coverage?.spec || null,
    environmentRequired: context === "EPP" ? "EPP_CONTEXT" : stagingRequired ? "STAGING" : "PREQA2",
    runtime: { status: runtimeStatus, environment: stagingRequired ? "S1/STG" : "PREQA2", evidence: stagingRequired ? stagingRuntime?.evidence || null : runtime?.evidence || null },
    blocker: stagingRequired ? stagingRuntime?.blocker || null : runtime?.blocker || null,
  };
}

module.exports = { MX_P1_LEGACY_LINKS, OTHER_PROVEN_LINKS, attachKnownEvidence };
