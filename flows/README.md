# Business Flows

`flows/` contains reusable browser/business flows that sit above individual Page Objects.

Current `flows/smb/` helpers are shared presentation/access behaviors used across SMB automation.

Target structure:

```text
flows/
  shared/
  mx/
  pe/
```

A flow belongs in `shared/` only when its business behavior is genuinely cross-market. Market-specific checkout/payment/address behavior should remain market-owned rather than being generalized solely to reduce file count.
