const architecture = require("../governance/smb-qst-architecture.json");
function runtimeEnvironment(explicit) {
  const value=String(explicit||process.env.CO_QST_ENVIRONMENT||process.env.TEST_ENV||"S2").toUpperCase();
  return value.includes("S1") && !value.includes("S2") ? "S1" : "S2";
}
function getCoQstEvidenceMetadata(zephyrId,{environment}={}) {
  const entry=architecture.markets.CO.cases.find(({id})=>id===zephyrId);
  if(!entry) throw new Error(`CO QST evidence metadata was not found for ${zephyrId}.`);
  return {zephyrId,market:"CO",store:entry.store,suite:"QST",feature:entry.feature,environment:runtimeEnvironment(environment),officialTitle:entry.title,reuseCandidate:entry.architecture};
}
module.exports={getCoQstEvidenceMetadata};
