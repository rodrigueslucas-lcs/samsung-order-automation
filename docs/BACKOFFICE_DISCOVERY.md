# BackOffice S2 Peru Discovery

**Environment:** BackOffice S2 Peru only  
**URL:** `https://backoffice.cnmzsgcaar-samsunge12-s2-public.model-t.cc.commerce.ondemand.com/backoffice/`  
**Discovery date:** 2026-08-25

## Access model

The login flow is `custom-login.zul` -> credentials -> authority chooser -> `PROCEED`.
Authentication is direct in real Chrome. Runtime credentials are typed sequentially,
each field is committed with `Tab`, and the authority is selected by its visible label.
Credentials are never stored by the project.

| Automation key | Authority displayed by the UI | Perspective | Usage |
|---|---|---|---|
| `admin` | `Customer Support Administrator Role` (`customersupportadministratorrole`) | `Administration Cockpit` | Admin Orders and CronJobs |
| `agent` | `Customer Support Agent Role` (`customersupportagentrole`) | `Customer Support` | `Order` / `Order-Enhanced` CS flows |

The authority chooser contains only these two roles. The perspective chooser contains
only `Administration Cockpit` and `Customer Support`. No Super Admin authority or
perspective was available to this user.

## Stable UI map

- Login: placeholders `Enter user name`, `Enter password`; buttons `Sign In`, `PROCEED`.
- Authority: rows named `Customer Support Administrator Role` and
  `Customer Support Agent Role`.
- Admin Orders: tree rows `Order` -> `Orders`; search placeholder `Type to search`;
  search action `button[title="Search"]`; result row name contains `Order Nr.: <code>`.
- CS Agent Orders: perspective `Customer Support`; entries `Order` and
  `Order-Enhanced`; search placeholder `Search by order code, email, name, mobile`;
  result row name contains `Order Number: <code>`.
- CronJobs: `System` -> `Background Processes` -> `CronJobs`; search placeholder
  `Type to search`; result row name contains `Code: <code>`.

## Test-case assessment

| TC | Status | Authority / perspective | Evidence, mass and strategy |
|---:|---|---|---|
| 64 | Automated | `customersupportadministratorrole` / Administration Cockpit | Direct login and authenticated perspective passed twice. Read-only. |
| 65 | Automated | `customersupportadministratorrole` / Administration Cockpit | Admin `Order` -> `Orders` passed. Read-only. |
| 66 | Automated | `customersupportagentrole` / Customer Support | Independent agent login plus `Order` and `Order-Enhanced` passed. Read-only. |
| 67 | Blocked | `customersupportagentrole` / Customer Support | S2 test-order mutation is authorized, but three execution attempts were stopped by the BackOffice HTTP 503 maintenance page before login. |
| 68 | Blocked | `customersupportagentrole` / Customer Support | Depends on TC67; no order could be opened while the S2 BackOffice was returning HTTP 503. |
| 69 | Automated | `customersupportadministratorrole` / Administration Cockpit | CronJobs page and both Peru job codes passed. Read-only; no job executed. |
| 70 | Blocked | `customersupportagentrole` / Customer Support | Advanced Customers search by UID `anonymous` returned a masked, unrelated visible record; identity as the global Anonymous customer was not proven. No address was edited or saved. |
| 71 | Automated | Both roles; admin test implemented | Deterministic read-only lookup passed. Automation accepts `BACKOFFICE_ORDER_CODE` and otherwise uses the observed S2 code. |
| 72 | Blocked | Admin or agent | Order selection by `Waiting for Send Financial` could not start because the BackOffice returned HTTP 503 on three attempts. |
| 73 | Blocked | `customersupportadministratorrole` / Administration Cockpit | Execution is authorized in S2, but the maintenance outage prevented login, pre-run confirmation and safe execution. |
| 74 | Blocked | Admin or agent | Depends on TC73; no order lifecycle could be observed during the outage. |
| 75 | Blocked | `customersupportadministratorrole` / Administration Cockpit | Execution is authorized in S2, but the maintenance outage prevented exact-code confirmation and safe execution. |
| 76 | Blocked | Admin or agent | Depends on TC75; no order lifecycle could be observed during the outage. |

## CronJobs

- `pe-tokoFinancialInitialUpdateJob`
- `pe-tokoTransferConsignmentToWarehouseJob`

Both were found successfully; the warehouse job was also observed `RUNNING / SUCCESS`
during TC69, confirming that status is dynamic. Neither was run. The
generic names without the `pe-` prefix must not be used as target codes.

## Execution notes

All BackOffice execution uses Playwright's real Chrome channel. Sequential keyboard
input plus `Tab` blur/change events resolved the SAP ZK submit race. Details are in
`BACKOFFICE_AUTH_INVESTIGATION.md`. The suite disables screenshot, video and trace.

## Required inputs for remaining coverage

### Latest execution attempt

On 2026-08-25, TC67-TC76 destructive validation was explicitly authorized for S2
Peru only. Three independent headed real-Chrome attempts reached the platform
maintenance page: `503: This service is down for maintenance. It will be back
shortly.` The failure happened before the login form, so no order was selected,
cancelled or changed and no CronJob was executed. `BackOfficePage.login()` now reports
this condition explicitly instead of timing out on a missing username field.

After maintenance ended, two independent headed real-Chrome attempts (the TC67
exploration and TC64) reached the normal login flow but were redirected through
`login.zul?login_error=1`. The same runtime credentials that had passed TC64 twice
earlier were rejected by the S2 server before authority selection. No order mutation
or CronJob execution was attempted without an authenticated session.

1. A disposable order explicitly approved for cancellation.
2. Deterministic orders in `Waiting for Send Financial`, `Order Split`, and
   `Shipping Requested`, or one isolated order approved for the lifecycle.
3. A user/authority that visibly enables `Run CronJob`, if execution is required.
4. A proven identifier for the SAP Commerce global Anonymous customer.

## S2 vs S3

S3 discovery uses the same Page Objects through `BACKOFFICE_ENV=s3`; S2 remains
the default and `BACKOFFICE_URL` remains available for an explicit endpoint.
The first headed real-Chrome smoke on 2026-08-25 produced the following evidence:

| Area | S2 | S3 |
|---|---|---|
| Login | Direct ZK login previously passed | Direct ZK login passed (TC64) |
| Authorities | Customer Support Administrator and Customer Support Agent | Both authorities accepted; no additional authority observed during smoke |
| Perspectives | Administration Cockpit; Customer Support | Administration Cockpit and Customer Support both loaded |
| Admin Orders | `Order` -> `Orders` | Same tree and search UI; TC65 passed |
| CS Orders | `Order` and `Order-Enhanced` | Customer Support loaded with both entries. S3 exposes the selected row's accessible name as `Order-Enhanced selected`; the compatible locator accepts both states |
| CronJobs | Both Peru-prefixed codes found | TC69 found the same exact codes: `pe-tokoFinancialInitialUpdateJob` and `pe-tokoTransferConsignmentToWarehouseJob`; neither was executed |
| Order mass | S2 fallback order `PE260819-75543032_260819182727780` existed during earlier discovery | The S2 fallback returned `No entries`. Read-only CS discovery found 19 S3 rows and selected `PE260817-69932056_260821145428295` as TEMPORARY TEST DATA for TC71. Multiple orders, including `PE260814-69911059`, were already `Shipping Requested`; no `Waiting for Send Financial` or `Order Split` row was visible on that first page |
| UI behavior | Login could be affected by S2 maintenance/deploy | S3 was stable through login, Admin Orders and CronJobs in this smoke; login/navigation was slower and approached the original 120-second test timeout |

S3 results are supplemental evidence only and do not change the official ST2 Peru
coverage matrix. No S3 order was changed and no CronJob was run during this smoke.

### S3 continuation results

- TC66 passed on the headed rerun after accepting both `Order-Enhanced` and the
  selected accessible name `Order-Enhanced selected`.
- TC71 passed with TEMPORARY S3 TEST DATA
  `PE260817-69932056_260821145428295`. S3 Admin search returned `No entries` for
  this existing code while the UI warned that the current language is not
  registered in the search engine; the compatible S3 test therefore uses the
  CS Agent `Order-Enhanced` search. S2 keeps the Admin implementation.
- The CS grid reported 135 orders across 7 pages. The cancellation candidate
  `PE260817-69932056_260821145428295` had customer status `processing` and
  Hybris status `TEMPORARY_EXPIRED`. Selecting it established Customer and
  Order session context and exposed the real `Cancel` action. Opening that
  action loaded the order editor with `Cancellation and Return` and
  `SMC Only Cancellation` sections plus `Refresh`/`Save`; it did not expose a
  confirmation dialog. No cancellation fields were changed and Save was not
  clicked, so TC67/TC68 remain unproven rather than reporting a false success.
- Read-only first-page evidence found multiple `Shipping Requested` orders,
  including `PE260814-69911059`, so the terminal status required by TC76 exists
  in S3. No `Waiting for Send Financial` or `Order Split` candidate was proven
  and neither CronJob was executed. TC72-TC75 remain pending further filtered
  or paginated discovery; the existing Shipping Requested row is evidence for
  TC76 only, not evidence of the complete lifecycle.
- Follow-up cancellation discovery tested three S3 candidates through the real
  `Cancel` action: registered `PE260817-69932056_260821145428295`
  (`processing` / `TEMPORARY_EXPIRED`), guest
  `PE260820-69963019_260820223552923` (`processing` /
  `TEMPORARY_EXPIRED`), and physical order `PE260814-69911059`
  (`processing` / `Shipping Requested`). In every case the resulting
  `Cancellation and Return` tab exposed four read-only text controls, while
  `SMC Only Cancellation` exposed no controls. There was no editable reason,
  quantity, status, dropdown, checkbox, mandatory field, or valid change to
  save. No order was mutated; TC67/TC68 remain unproven for the mass currently
  exposed by the first grid page.
- A visibility-scoped scan of the actual `Customer Order Status` grid validated
  all 19 rows on the visible page. Counts were: `Waiting for Send Financial` 0,
  `Order Split` 0, and `Shipping Requested` 7. Shipping Requested codes were
  `PE260814-69911059`, `PE260807-69822048`, `PE260813-69890102`,
  `PE260730-69723080`, `PE260812-69883030`, `PE260811-69880022`, and
  `PE260807-69823212`. The UI reports 135 items / 7 pages, but the visible
  `Next Page` controls belong to parallel ZK widgets and neither the grid-adjacent
  nor `135 items` ancestor resolved to the order pager. Safety loop detection
  prevented repeated navigation. No fulfillment CronJob was executed without
  a proven pre-state candidate.

### S3 pagination and fulfillment candidates

The correct Order-Enhanced pager was resolved without invoking ZK internals
artificially. The visible pager is `nav.z-paging`, displayed `/ 7`. A normal
second-page click emitted `POST /zkau` with `cmd_0=onPaging`, the pager's dynamic
`uuid_0`, and `data_0={"":1}`. Scoping the rows to the list-view that contains
both this pager and the `Customer Order Status` header allowed all seven pages
to be read through normal UI events while waiting for each ZK response and
`zk.processing` to finish.

The environment changed from 135 to 133 displayed items during discovery and
some boundary rows were repeated while the live dataset refreshed, so raw row
counts are not treated as a stable inventory. The scan nevertheless proved the
following Hybris statuses: `TEMPORARY_EXPIRED`, `Shipping Requested`,
`PARTIAL_RETURN_SHIPPING_REQUESTED`, `TEMPORARY_DUPLICATE`, `Completed`,
`Shipped`, `WAITING_FOR_SEND_FINANCIAL`, `Order Split`, `PICKUP_COMPLETE`,
`Cancelled`, and `WAITING_FOR_EXTERNAL_SERVICE_PROCESS`.

Unique TEMPORARY S3 TEST DATA discovered for the financial pre-state:
`PE260730-69727105`, `PE260730-69725040`, `PE260730-69723375`,
`PE260729-69711041`, `PE260729-69711013`, and `PE260728-69700004`.
The Order Split candidate is `PE260730-69725073`. This establishes read-only
evidence for TC72 and TC74 and provides eligible candidates for TC73/TC75.

Before the execution interruption, `pe-tokoFinancialInitialUpdateJob` was read
as `Current status: FINISHED` and `Last result: SUCCESS`. The exploration only
opened/searched the CronJobs list and inspected actions; the row remained
unselected (`0 items selected`) and no Run action, confirmation, or execution
was triggered. On resumption, two independent headed attempts on 2026-08-26
were denied before the login form with `403: The server did not authorize the
request`. Consequently neither the financial nor warehouse CronJob was run,
no post-job snapshot exists, and no order change can be attributed to these
tests. TC73 and TC75 remain blocked by current S3 access; TC76 retains the
existing read-only Shipping Requested evidence.

### S3 fulfillment automation prepared during the access interruption

The offline implementation now provides reusable order-grid helpers for normal
UI pagination, dynamic lookup by Hybris status or order code, opening the
selected order, reading Customer/Hybris status, and refreshing an order.
Pagination is scoped to the list view containing the `Customer Order Status`
grid and its visible `nav.z-paging`. Every transition waits for the normal
`/zkau` response and `zk.processing`, rejects repeated page signatures, and has
a 20-page safety limit.

CronJob helpers cover exact-code lookup, row selection, state extraction,
Run/confirmation discovery, and polling until `FINISHED`. The Run control is
prepared but remains unvalidated against a live authenticated S3 session; it
must not be reported as executed until before/after states are captured.

`backoffice-fulfillment.spec.js` contains TC72-TC76 guarded for S3. TC72
dynamically selects `WAITING_FOR_SEND_FINANCIAL`; TC74 reopens the same order
after the financial job. TC75 runs the warehouse job and TC76 reopens the
selected split order. These codes are fallback-only **TEMPORARY S3 TEST DATA**:

- financial: `PE260730-69727105`
- split: `PE260730-69725073`

They can be overridden with `BACKOFFICE_FINANCIAL_ORDER_CODE` and
`BACKOFFICE_SPLIT_ORDER_CODE`. Playwright successfully listed all five cases.
A headed TC72 launch on 2026-08-26 was skipped safely because runtime
credentials were absent from that terminal; no login, order change, or CronJob
execution occurred.

Cancellation discovery is also prepared for the next authenticated S3 window.
It scans all unique orders through the same grid/pager association, excludes
the three previously disproven codes and the `TEMPORARY_EXPIRED`,
`Shipping Requested`, and `Cancelled` statuses, then inspects both cancellation
sections for visible controls and distinguishes disabled/read-only controls
from genuinely editable ones. The discovery intentionally does not guess field
values or click Save: TC67/TC68 remain pending until the real editable schema is
observed and the minimum valid payload can be filled deliberately.

### Live S3 execution on 2026-08-26

S3 authentication recovered and TC72 passed headed in real Chrome after a
pager synchronization correction. The normal `/zkau` response can complete
before the next page's rows replace the previous DOM, so navigation now also
waits for the visible order-code signature to change. TC72 dynamically opened
a `WAITING_FOR_SEND_FINANCIAL` order; the approved deterministic fallback for
the isolated chain remains `PE260730-69727105`.

TC73 selected `pe-tokoFinancialInitialUpdateJob` and read its pre-state as
`FINISHED / SUCCESS`. The live detail panel exposed the real control
`button[title="Run CronJob"]` (`font-icon--begin`), but it was disabled for
`customersupportadministratorrole`. `Lock item`, `Abort CronJob`, and
`Delete CronJob Logs` were also disabled, and the row context menu contained no
alternative actions. The job was not executed.

The independent fallback `PE260730-69725073` passed TC74 with Hybris status
`Order Split`. TC75 found the exact warehouse job but its Run action was blocked
by the same disabled-control condition, so no transition attributable to
`pe-tokoTransferConsignmentToWarehouseJob` occurred. TC76 retains read-only
evidence from the previously listed Shipping Requested orders but was not
reported as a post-job pass.

Cancellation discovery scanned the full paged dataset and then searched each
eligible snapshot candidate by code. The live dataset changed during the run
(`PE260814-69906064` disappeared between snapshot and reopening). A second run
continued for the five-minute safety timeout without finding a proven editable
editor. No Save was clicked and no order was cancelled.

### S3 execution with full administrator

The full administrator authenticates directly into `Administration Cockpit`;
there is no authority chooser or `PROCEED` step. This differs from CS Admin,
which exposes Customer Support Administrator/Agent roles and requires an
explicit selection. `BackOfficePage.login()` now supports both flows without
storing user-specific credentials.

With the full administrator, `button[title="Run CronJob"]` was enabled for both
authorized jobs. Each action opened the real `Run CronJob` confirmation dialog
with `Yes` and `Cancel`. The Page Object now waits for the dialog, clicks `Yes`,
waits for it to close, and polls the exact job.

`pe-tokoFinancialInitialUpdateJob` completed as `FINISHED / SUCCESS`. A post-run
seven-page snapshot showed that all six known orders remained
`WAITING_FOR_SEND_FINANCIAL`; no new Order Split was caused by this execution.
Three rows exposed FI/CO interface errors and `No matching sap document`.
`PE260730-69727105` remained in the initial state, so TC73 has real S3 job
execution evidence while causal TC74 remains unproven for that order.

`pe-tokoTransferConsignmentToWarehouseJob` also completed as
`FINISHED / SUCCESS`, making TC75 a real S3 job-execution pass. Candidate
`PE260730-69725073` remained `Order Split`; its row reported
`NERP_ORDER_CREATE` and `Item category YNS2 is not defined for item`. TC76 did
not pass causally, although Shipping Requested remains proven read-only on
other S3 orders. Neither job changed a known candidate's Hybris status.

## Official Order Process Reference

The official Peru lifecycle is:

`WAITING_FOR_SEND_FINANCIAL`
→ `pe-tokoFinancialInitialUpdateJob`
→ `ORDER_SPLIT`
→ `pe-tokoTransferConsignmentToWarehouseJob`
→ `SHIPPING_REQUESTED`
→ external GERP/Bifrost processing through GI1
→ `pe-bulkFetchConsignmentUpdateJob`
→ `SHIPPED`
→ billing/financial completion
→ `pe-tokoFinancialCompletionJob`
→ `COMPLETED`.

A CronJob ending `FINISHED / SUCCESS` proves execution, not that every order was
eligible. TC72, TC74 and TC76 are status checkpoints; TC73 and TC75 validate job
execution. Orders remaining in their previous state are reported with ERP/FI or
NERP evidence rather than classified as Playwright or CronJob failures.

CS Agent cancellation is allowed in `WAITING_FOR_SEND_FINANCIAL`, `ORDER_SPLIT`,
and `SHIPPING_REQUESTED`, and unavailable after DO / `SHIPPING_PREPARATION`.
The documented S3-only remediation is order `ORDER_SPLIT` plus consignment
`WAITING_FOR_TRANSFER`; any use must be recorded and never applied in Production.

A headed discovery restricted to these official cancellable states ran for its
five-minute safety window without proving an editable cancellation editor.
No product checkbox, reason, quantity, `Confirm Selected`, confirmation, or Save
was submitted. TC67/TC68 therefore remain unproven; the documented S3 status
remediation was not applied because the Admin order/consignment fields and
original values were not yet mapped safely.

After `SHIPPING_REQUESTED`, GERP/Bifrost/GI1 is a human/external dependency.
The POC needs Order Number, SO, and IMEI/Serial Number. This project has no
authorized interface for that process and does not automate it.

### TC67 / TC68 focused cancellation execution

Headed checks used only officially cancellable states. Live candidates
`PE260730-69725073` (`Order Split`) and `PE260730-69727105`
(`WAITING_FOR_SEND_FINANCIAL`) opened `Cancellation and Return`, but neither
exposed a product row, checkbox, quantity/reason, or `Confirm Selected`.
The editable-looking fields were unrelated: `Additional Grace Cancellation
Days / Partner Code` and `Customer Name / Customer Email`. Nothing was entered,
confirmed, or saved.

The approved S3 remediation was investigated with the full administrator, but
Admin Orders returned no result for `PE260730-69727105` although CS Agent still
showed it. Because the original consignment status could not be read safely,
`ORDER_SPLIT` plus `WAITING_FOR_TRANSFER` was not applied. TC67 and causal TC68
remain blocked by S3 test-data/index access rather than a Playwright assertion.
