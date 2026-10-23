async function resolveMxBcCareChoice({ noCare, enabledAdd, selectOptOut, timeout = 30000 }) {
  // Care+ is an optional product configuration. The exact SKU's enabled CTA
  // proves it is not blocking this purchase when no Care+ choice is offered.
  await noCare.or(enabledAdd).first().waitFor({ state: 'visible', timeout });
  if (await noCare.isVisible()) {
    await selectOptOut();
    await enabledAdd.waitFor({ state: 'visible', timeout });
    return { careProtectionOffered: true, careProtectionDeclined: true };
  }
  await enabledAdd.waitFor({ state: 'visible', timeout });
  return { careProtectionOffered: false, careProtectionDeclined: false };
}
module.exports = { resolveMxBcCareChoice };
