# Versioned Test Fixtures

These fixtures belong primarily to the established PE/ST2 automation generation.

## PE compatibility data

`utils/testData.js` currently imports:

```text
fixtures/pe/customer.json
fixtures/pe/address.json
fixtures/pe/billingAddress.json
fixtures/card.json
```

The non-payment PE data is now explicitly market-namespaced under `fixtures/pe/`.

The legacy PE card fixture remains at the root temporarily because payment data should not be casually copied/moved while PE still consumes the versioned compatibility bundle. Its eventual migration should use the same deliberate runtime-secret boundary used by current MX automation.

PE DST specs still consume `utils/testData.js`, so this compatibility data is **not dead legacy** today.

## MX card data is different

Active MX payment automation does **not** use `fixtures/card.json` as its runtime credential. MX reads the ignored runtime file:

```text
playwright/.auth/mx-test-card.json
```

through `utils/mxTestCard.js`, with Jenkins injecting `samsung-mx-test-card`.

Do not merge PE and MX payment-data mechanisms merely to reduce file count.

## Reporting fixtures

`executive-v3/` contains deterministic reporting test data, not storefront runtime credentials. It should eventually move next to the reporting integrity tests when the reporting tree is consolidated.
