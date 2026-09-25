// PE/ST2 compatibility fixture bundle.
//
// This module is still consumed by the established PE DST generation under
// tests/s2/pe/dst. Do not reuse it for active MX payment data: MX reads the
// ignored runtime credential playwright/.auth/mx-test-card.json via
// utils/mxTestCard.js.
import customer from "../fixtures/customer.json";
import address from "../fixtures/address.json";
import card from "../fixtures/card.json";
import billingAddress from "../fixtures/billingAddress.json";

export const testData = {
  customer,
  address,
  card,
  billingAddress,
};
