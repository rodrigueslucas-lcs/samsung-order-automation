async function waitForCoShippingForm(delivery) {
  const department = delivery.locator('mat-select[name="regionIso"]');
  const newAddress = delivery.locator('input[name="addressOptionShipping"][value="NEW_ADDRESS"]');
  // One Playwright wait: parallel waits can invoke the same overlay handler twice.
  await department.or(newAddress).filter({ visible: true }).first()
    .waitFor({ state: 'visible', timeout: 30000 });
}
module.exports = { waitForCoShippingForm };
