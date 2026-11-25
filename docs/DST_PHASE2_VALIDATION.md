# DST Phase 2 — detailed definitions and first LATAM expansion

Scope: nine targeted Base Store P1 pilots, not a 362-case campaign. Phase 1 commit `24344554` and its reconciliation/coverage files are historical baselines and remain unchanged. QST jobs, authenticated bundles and existing payment behaviour are preserved.

## Definition authority

The Jira connector returned `USER_NOT_LOGGED_IN`. The operator-supplied detailed workbooks were read without modification. Nine exact SAM records were compared with the current DST source crosswalk and the 144-record semicolon CSV `PE_QST_34.csv` (its filename is misleading). Description, step, preconditions and expected result agree exactly. Exported historical `PASS` values are not execution evidence.

`governance/dst-phase2-definitions.json` preserves verbatim fields, workbook read-byte SHA-256, sheet/cell references, CSV record and authority `OPERATOR_SUPPLIED_OFFLINE_ZEPHYR_FIELDS`. This proves an offline definition match, not a live Jira verification. The exports cover 144 P1/QST definitions; detailed definitions for 218 P2 cases remain unavailable.

| Market | TC | Workbook / sheet / range | Phase 1 review |
|---|---|---|---|
| MX | SAM-24969 | Samsung_MX_QST_37_TCs_Detalhados.xlsx · MX_QST_37 · A34:I34 | Detailed step includes selected variant, price and colour. Added DST-only native price/colour checks before Add; missing native colour is an explicit blocker. |
| MX | SAM-24971 | Same workbook · A33:I33 | Seven cart clauses retained, including conditional services, info icons and footer. |
| MX | SAM-24972 | Same workbook · A32:I32 | Increase, decrease and remove product; persisted cart checks retained. |
| MX | SAM-24988 | Same workbook · A26:I26 | Cart Checkout enters the checkout flow; no payment submission required. |
| PE | SAM-25064 | Samsung_PE_QST_34_TCs_Detalhados (1).xlsx · PE_QST_34 · A30:J30 | Right-side summary, coupon field/link, subtotal, savings, total and information text. Existing registered identity is an allowed source precondition. |
| PE | SAM-25065 | Same workbook · A29:J29 | Added actual hovered Rewards tooltip text at Cart, Checkout and Payment, beyond the Phase 1 label checks. No prescribed literal tooltip copy was invented. |
| PE | SAM-25081 | Same workbook · A22:J22 | Checkout button and resulting checkout state retained. |
| CO | SAM-24920 | Samsung_CO_QST_35_TCs_Detalhados.xlsx · CO_QST_35 · A9:J9 | New pilot proves both order/product queries in both basic/advanced modes. |
| CL | SAM-24830 | Samsung_CL_QST_38_TCs_Detalhados.xlsx · CL_QST_38 · A10:J10 | Same four read-only requirements using CL order and configured CL product. |

For both BO cases the original “User is on payment page” text is preserved. The operator confirmed **“É texto genérico do export”**; it does not require checkout. Operational prerequisites are authorized environment-scoped BO access, an existing order for that market, and an existing configured product. No order is created. The CO first run exposed Products retaining Advanced mode; the shared catalog Page Object now recognizes that state and selects Basic mode once before the basic query. Existing QST consumers benefit from the same fix.

## Targeted execution

```bash
npm run dst:co -- --store BASE_STORE --priority P1 --ids SAM-24920 --list
npm run dst:cl -- --store BASE_STORE --priority P1 --ids SAM-24830
npm run dst:mx -- --store BASE_STORE --priority P1 --ids SAM-24971,SAM-24972,SAM-24988
npm run dst:pe -- --store BASE_STORE --priority P1 --ids SAM-25064,SAM-25065,SAM-25081
```

Use `DST_ENVIRONMENT=S2` (default) and optional `BROWSER_MODE=headed`. SAM-24969 additionally requires an already valid WMC/PreQA2 session. The runner verifies pinned official source hashes and rejects wrong market/store/priority, unsupported IDs, production and empty selections. P2 selection is structurally supported, but unimplemented rows fail closed; there is no legacy/QST fallback.

Each invocation uses one worker, no retries, a normal market lease, distinct `test-results/dst/<market>/<store>/<priority>/<run>/` JSON/HTML/Playwright/evidence output, and disabled payment/order/profile-write gates. Request guards also reject financial submissions. No automatic session renewal/export or campaign execution occurs. List mode acquires no session and performs no navigation.

## Jenkins preparation — design only

Future DST jobs should select market, store, environment, priority and explicit approved IDs, then invoke the same runner above. Use distinct DST report/artifact paths; never consume QST success as DST evidence. Store and priority remain runtime selections under the canonical market/suite/store tree. No new Jenkins job, build or configuration was applied in this phase.

Use existing CI authentication installation and read-only verification, without a refresh inside business tests. Serialize runs sharing an identity/cart and serialize **all BackOffice admin pilots across markets** because they use the shared BO administrator. Local leases are a backstop, not permission to bypass an occupied resource. Pipeline stages should be scope validation → discovery → approved targeted execution → DST-only evidence/report publication. A missing definition, unsupported P2 case or unavailable prerequisite must be reported distinctly from a functional failure. Full campaigns require a separate reviewed expansion.

## Evidence and next expansion

Nine distinct pilots were actually attempted in S2 during this phase:

| Market | PASS | FAIL | BLOCKED | NOT_RUN among selected pilots |
|---|---|---|---|---|
| MX | SAM-24971, SAM-24972, SAM-24988 | SAM-24969 | — | — |
| PE | SAM-25064, SAM-25065, SAM-25081 | — | — | — |
| CO | SAM-24920 | — | — | — |
| CL | SAM-24830 | — | — | — |

**8 PASS / 1 FAIL**, not approval of the remaining 353 official DST rows. The current WMC session was accepted; SAM-24969 reached the exact native selected device/storage and displayed price, then refused to Add because no selected colour control was rendered for the configured SKU. Its raw result also contains a trace archive `EBUSY` error. Both errors remain recorded; the whole run is therefore FAIL, rather than hiding the unrelated artifact error behind BLOCKED. Request a supported authorized BC variant with a readable native colour selection, or a clarification of that detailed colour step, before declaring conformance. Do not substitute a SKU silently.

SAM-25065 had earlier failed attempts: an unnecessary tooltip cleanup expectation, a contact update POST without response through 120 seconds, and a Cart-only tooltip selector applied to Checkout. The cleanup and observed Cart/Checkout selector differences were corrected and tested. The subsequent real run reached Payment and proved all three hovered tooltips; the transient contact transport attempt remains in history. No payment was submitted and no contact timeout budget was increased.

The final PE Rewards evidence is `test-results/dst/pe/base_store/p1/1795635117479-27536/results.json`; its three stage annotations are required by the coverage integrity test. CO/CL proof includes all four search flags in business evidence. MX BC screenshot and original unarchived trace material remain in the ignored run directory; no artifact was deleted to obtain a passing result.

Current results, failed attempts and explicit blockers are captured in `governance/dst-phase2-coverage.json`; discovery and governance results are separate from runtime. Raw local reports and traces remain ignored. Live connector verification and remaining P2 detailed definitions are outstanding. Before adding more CO/CL cases, select non-financial current source rows, obtain their detailed definitions, and map their actual prerequisites; do not clone another market by changing URLs.

Candidates for a subsequent reviewed expansion are the cart presentation scenarios `CO-BASE_STORE-11` and `CL-BASE_STORE-9`. Their current source rows are P1/DST, but this phase does not bind a new SAM by title similarity or implement them. First establish exact export identity and detailed clauses, then evaluate reuse of the existing cart presentation assertions. Resolve the MX colour definition/data gap before claiming the full first pilot set is conformant.

## Changed files

| Concern | Files |
|---|---|
| Definition contracts and coverage | `governance/dst-phase2-definitions.json`, `governance/dst-phase2-pilot.json`, `governance/dst-phase2-coverage.json` |
| Targeted execution and metadata | `package.json`, `scripts/run-dst.cjs`, `utils/dstExecution.cjs`, `utils/dstPilot.cjs` |
| Additional MX detailed checks | `flows/mx/dstBcAssertions.js`, optional hook in `flows/mx/bcAddToCart.js`, `tests/markets/mx/dst/base-store/bc-add.spec.js` |
| PE Rewards tooltips | `flows/smb/dstCartAssertions.js`, `tests/markets/pe/dst/base-store/rewards.spec.js` |
| Read-only BackOffice pilots and native mode readiness | `pages/BackOfficeCatalogPage.js`, `flows/smb/dstBackOfficeSearch.js`, `tests/markets/co/dst/base-store/backoffice.spec.js`, `tests/markets/cl/dst/base-store/backoffice.spec.js` |
| Definition provenance in pilot evidence | `flows/smb/dstPilotSafety.js` |
| Focused regression contracts | `governance/tests/dstPhase2.test.cjs`, basic-mode fixture update in `governance/tests/clBuild156Readiness.test.cjs` |
| Documentation | `README.md`, this report, `tests/markets/co/dst/README.md`, `tests/markets/cl/dst/README.md` |

No QST executable spec, authentication implementation, session material, Jenkins job or reporting implementation was changed. The shared BackOffice PO fix is covered by real CO/CL pilot execution and existing/new readiness tests. The MX business flow only gains an optional callback used by DST; existing QST callers retain their previous behaviour. No compatibility boundary was removed or recreated.

## Validation closeout

| Type | Command/check | Result |
|---|---|---|
| TARGETED_RUNTIME | Nine distinct S2 DST pilots via `node scripts/run-dst.cjs` with explicit market/store/P1/IDs | 8 PASS, 1 FAIL; full history in the matrix |
| DISCOVERY | The same nine IDs with `--list` | MX 4, PE 3, CO 1, CL 1; no navigation |
| UNIT | `node --test governance/tests/dstPhase2.test.cjs governance/tests/dstPilot.test.cjs governance/tests/backofficeZkReadiness.test.cjs` | 31/31 PASS |
| UNIT | `npm run dst:phase2:gate` against the final matrix | 8/8 PASS |
| UNIT | `node --test governance/tests/clBuild156Readiness.test.cjs governance/tests/authBrowserEndpoint.test.cjs` | 15/15 PASS |
| STATIC / DISCOVERY / UNIT | `npm run repo:refactor:gate` | Final complete run PASS: architecture, legacy/PE audits, official scope, QST business steps, all configured QST discovery, 1,773/1,773 governance, 4/4 Executive and 39/39 MX runtime/reporting |
| GIT | `git diff --cached --check` and delivery review | No whitespace errors; only the 23 source/documentation files listed above, no credentials, authenticated bundles, local agent files or raw runtime artifacts |

All listed final unit sets have zero skipped tests. The first broad gate recorded 1,771/1,773: a real temporary Chrome endpoint was unavailable and the old CL readiness mock lacked the new mode-inspection methods. The mock retained its original AU-before-toolbar assertion; auth implementation was not changed. Both tests passed on focused revalidation and the subsequent complete gate passed. Original logs remain local at `.agent/dst-phase2/refactor-gate.log`; the passing complete run is `.agent/dst-phase2/refactor-final-gate.log`.

QST regression here is architecture/discovery plus shared-component/governance/reporting validation, not a new real full QST campaign. No full DST campaign, payment/order submission, auth refresh/export or Jenkins build/job creation was performed. Formal approval of all 362 scenarios is not claimed.
