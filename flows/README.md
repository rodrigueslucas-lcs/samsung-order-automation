# Business Flows

`flows/` contains reusable browser/business flows that sit above individual Page Objects and outside executable test ownership.

Canonical ownership rule:

```text
tests/markets/<market>/<suite>/<store>/  -> executable specs / local fixtures
flows/<market>/                          -> market-specific reusable business flows
flows/smb/                               -> genuinely cross-market SMB flows
```

Current structure:

```text
flows/
  cl/
    qstFlows.js
  smb/
    cartPresentation.js
    storefrontAccess.js
  eppStorefront.js
```

A flow belongs in a shared location only when its behavior is genuinely cross-market. Market-specific checkout, payment, address or authentication behavior stays market-owned rather than being generalized only to reduce file count.

Do not leave reusable `*Flows.js` modules loose at `tests/markets/<market>/qst` suite roots. The test tree is for ownership/navigation; reusable implementation belongs under `flows/`.
