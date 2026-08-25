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
| 67 | Blocked | `customersupportagentrole` / Customer Support | Cancellation changes state. No order has been proven disposable; do not submit cancellation. |
| 68 | Blocked | `customersupportagentrole` / Customer Support | Depends on a safely cancelled order from TC67. |
| 69 | Automated | `customersupportadministratorrole` / Administration Cockpit | CronJobs page and both Peru job codes passed. Read-only; no job executed. |
| 70 | Blocked | `customersupportagentrole` / Customer Support | Advanced Customers search by UID `anonymous` returned a masked, unrelated visible record; identity as the global Anonymous customer was not proven. No address was edited or saved. |
| 71 | Automated | Both roles; admin test implemented | Deterministic read-only lookup passed. Automation accepts `BACKOFFICE_ORDER_CODE` and otherwise uses the observed S2 code. |
| 72 | Blocked | Admin or agent read-only | No deterministic order in `Waiting for Send Financial` was identified. |
| 73 | Blocked | `customersupportadministratorrole` / Administration Cockpit | `pe-tokoFinancialInitialUpdateJob` found as `FINISHED / SUCCESS`; `Run CronJob` is disabled. No higher authority/perspective or safe affected mass is available. |
| 74 | Blocked | Admin or agent read-only | No deterministic order in `Order Split` was identified. |
| 75 | Blocked | `customersupportadministratorrole` / Administration Cockpit | `pe-tokoTransferConsignmentToWarehouseJob` found as `FINISHED / SUCCESS`; execution is disabled and mass impact is unproven. |
| 76 | Blocked | Admin or agent read-only | No deterministic order in `Shipping Requested` was identified. |

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

1. A disposable order explicitly approved for cancellation.
2. Deterministic orders in `Waiting for Send Financial`, `Order Split`, and
   `Shipping Requested`, or one isolated order approved for the lifecycle.
3. A user/authority that visibly enables `Run CronJob`, if execution is required.
4. A proven identifier for the SAP Commerce global Anonymous customer.
