# CL S2 payment validation

The official cases remain in `tests/markets/cl/qst/base-store/official-p1.spec.js`.
Shared execution is in `flows/cl/paymentFlows.js`. S1/S2 remains runtime configuration.
Runtime evidence below covers S2 only; S1 execution has not been validated by this change.

## Runtime evidence (2026-10-19)

| Case | Evidence and remaining work |
| --- | --- |
| SAM-24822 credit/debit | MercadoPago rejected both official Chile Mastercard and Amex fixtures with HTTP 200, `submitOrderDataWsDto`, business code `601`, `payment generic error`. No Samsung confirmation was observed. Native Webpay is now selected with its own panel's submit button; the final rerun stopped at registered-session validation before checkout. Webpay completion remains unproven. |
| SAM-24823 bank transfer | Native Khipu created order `CL261019-78730384` and opened the genuine Flow sandbox. Resuming that same attempt, confirming the simulator once, and returning to Samsung proved the exact order confirmation. This was a diagnostic continuation, not an uninterrupted official-test PASS. The reusable flow now handles that simulator transition. |
| SAM-24824 interest-free installments | The inspected Chile Mastercard offered only one installment. The case reports missing eligible interest-free multi-installment data; it does not submit payment or count one installment as coverage. |
| SAM-24826 order confirmation | Uses the native bank-transfer confirmation flow. The underlying exact-order return was proven by the continuation above; this official case has not yet passed with the final implementation in one execution. |

Technical artifacts are under ignored `test-results/cl-s2-mastercard`, `cl-s2-amex`,
`cl-s2-transfer-installments`, `cl-s2-transfer-native`,
`cl-s2-transfer-resume-ready`, `cl-s2-webpay-card-ready`, and `cl-s2-webpay-scoped`.
Treat raw traces as sensitive runtime artifacts; do not publish auth or provider tokens.

## Findings to investigate

- **MercadoPago rejection:** both Chile test brands received the same explicit `601` business rejection. Verify merchant test configuration and compatible Chile fixtures before another attempt. The response does not identify the underlying cause, so neither a product defect nor a specific credential/configuration failure is proven.
- **Automation fixed:** while Webpay details loaded, the global pay-button locator could still select MercadoPago's previous button. The trace showed Webpay details followed by a MercadoPago submit returning `301 checksum error`. Submit selection is now scoped to the chosen expansion panel and waits for its enabled button. That old `301` is not evidence of a Webpay backend defect.
- **Data missing:** provide a Chile card/bank/product combination that actually offers at least two installments explicitly without interest. Current observed mass offers only one.
- **Session prerequisite:** the last isolated rerun could not render the profile control in a fresh CL S2 context, including persisted-state recovery. Browser login alone does not prove the exported state is usable. Verify/export the correct CL S2 session before final runtime validation.

## Operator configuration

Payment execution requires `ALLOW_PAYMENT_SUBMIT=1` and a verified registered CL session.
Orders are normalized to quantity one. Submission is never automatically retried.
Inspect an ambiguous result before running the case again; confirmed bank orders must not be resubmitted.

`CL_QST_CARD_PROVIDER=webpay` is the native credit/debit default.
`CL_QST_CARD_PROVIDER=mercado` selects direct MercadoPago card entry.
Installment validation uses the direct card form and its actual offered options.

Direct card fixtures are market-specific. Set `CL_TEST_CARD_BRAND=mastercard` or `amex`.
Provision an ignored `playwright/.auth/cl-test-card.json` with brand objects, each containing
`number`, `holderName`, `expiry`, `cvv`, and `document`; or set the corresponding
`CL_TEST_CARD_NUMBER`, `CL_TEST_CARD_HOLDER`, `CL_TEST_CARD_EXPIRY`,
`CL_TEST_CARD_CVV`, and `CL_TEST_CARD_DOCUMENT` runtime variables.
`CL_TEST_CARD_FILE` overrides the ignored fixture path. Never commit fixture contents.
The loader deliberately does not borrow the MX card credential.

Official fixture reference: [MercadoPago Chile test cards](https://www.mercadopago.cl/developers/es/docs/your-integrations/test/cards).
Jenkins direct-card/installment execution needs these CL-specific runtime inputs;
an existing MX fixture binding does not satisfy that prerequisite. No Jenkins configuration
or credentials were changed by this patch.
