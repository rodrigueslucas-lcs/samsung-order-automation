const test = require("node:test");
const assert = require("node:assert/strict");
const { getExecutionRequirement } = require("../utils/preqa2ExecutionRequirements");

test("MX registered account scenarios are not satisfied by WMC authentication", () => {
  for (const id of ["SAM-24962", "SAM-24963", "SAM-24986", "SAM-24991", "SAM-24992", "SAM-24993"]) {
    const requirement = getExecutionRequirement("MX", id);
    assert.equal(requirement.accountContext, "registered");
    assert.equal(requirement.requiresSamsungAccount, true);
  }
});

test("guest save-address visibility scenario explicitly requires guest state", () => {
  const requirement = getExecutionRequirement("MX", "SAM-24995");
  assert.equal(requirement.accountContext, "guest");
  assert.equal(requirement.requiresGuestState, true);
});

test("EPP registered payment preserves both prerequisites", () => {
  const mx = getExecutionRequirement("MX", "SAM-25045");
  const pe = getExecutionRequirement("PE", "SAM-25138");
  assert.equal(mx.requiresEppContext, true);
  assert.equal(mx.requiresSamsungAccount, true);
  assert.equal(pe.requiresEppContext, true);
  assert.equal(pe.requiresSamsungAccount, true);
});

test("unknown account context stays unknown rather than being guessed", () => {
  const requirement = getExecutionRequirement("MX", "SAM-24968");
  assert.equal(requirement.accountContext, "unknown");
  assert.equal(requirement.requiresSamsungAccount, false);
  assert.equal(requirement.requiresGuestState, false);
});

test("non-official IDs fail closed", () => {
  assert.throws(() => getExecutionRequirement("MX", "SAM-00000"), /not an official/);
});
