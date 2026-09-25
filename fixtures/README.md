# Versioned Test Fixtures

These fixtures belong primarily to the established PE/ST2 automation generation.

`utils/testData.js` imports:

- `customer.json`
- `address.json`
- `billingAddress.json`
- `card.json`

PE DST specs still consume that bundle, so these files are **not dead legacy** today.

## MX card data is different

Active MX payment automation does **not** use `fixtures/card.json` as its runtime credential. MX reads the ignored runtime file:

```text
playwright/.auth/mx-test-card.json
```

through `utils/mxTestCard.js`, with Jenkins injecting the `samsung-mx-test-card` secret file.

Do not merge or delete these mechanisms until PE is migrated/reconciled and all consumers of `utils/testData.js` are removed or updated.

`executive-v3/` under fixtures contains deterministic reporting test data, not storefront runtime credentials.
