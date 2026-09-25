// PE/ST2 compatibility fixture bundle.
//
// This module is still consumed by the established PE DST generation under
// tests/s2/pe/dst. Do not reuse it for active MX payment data: MX reads the
// ignored runtime credential playwright/.auth/mx-test-card.json via
// utils/mxTestCard.js.
//
// Non-payment PE fixtures are market-namespaced under fixtures/pe. The legacy
// card fixture remains at fixtures/card.json until the PE payment-data path is
// migrated through the approved secret/runtime mechanism.
import customer from "../fixtures/pe/customer.json";
import address from "../fixtures/pe/address.json";
import card from "../fixtures/card.json";
import billingAddress from "../fixtures/pe/billingAddress.json";

export const testData = {
  customer,
  address,
  card,
  billingAddress,
};
