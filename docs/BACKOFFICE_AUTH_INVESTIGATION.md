# BackOffice S2 Peru authentication investigation

## Result

Direct Playwright login works in headed real Chrome (`channel: "chrome"`). Credentials
are read only from `BACKOFFICE_USERNAME` and `BACKOFFICE_PASSWORD` at runtime.

## Cause of `Processing...`

With `fill()` followed immediately by submit, the customized SAP ZK form sent
`/backoffice/j_spring_security_check` and received HTTP 200, then raised JavaScript
`y is not a function`, aborted navigation to `/backoffice/`, aborted a ZK ping and
returned to `custom-login.zul`. The mask was a symptom of a broken ZK event sequence,
not a server timeout.

The successful interaction reproduces human input events:

1. Focus username and use `pressSequentially()`.
2. Press `Tab` so ZK receives change/blur.
3. Use `pressSequentially()` for password and press `Tab` again.
4. Wait for ZK processing to become idle.
5. Click the real `Sign In` button.
6. Select the authority by its visible label and click `PROCEED`.
7. Require `Administration Cockpit` or `Customer Support` to become visible.

No fields are cleared after submit. The earlier clearing step was another possible
race with asynchronous ZK AU processing and was removed.

## Safe diagnostic observations

- One main frame; no popup or authentication iframe.
- The login response used `/backoffice/zkau` and
  `/backoffice/j_spring_security_check`, both HTTP 200.
- The login-page context had no localStorage/sessionStorage keys.
- Session cookies included a host-scoped HttpOnly `JSESSIONID` and route-affinity
  cookie; values were never logged.
- The real Chrome user agent alone did not fix the flow; input event ordering did.

## Validation

- TC64 passed twice with independent direct logins.
- TC65, TC66, TC69 and TC71 passed with independent direct logins.
- TC66 explicitly selected `Customer Support Agent Role`; admin state was not reused.
- Temporary hybrid authentication and diagnostic scripts were removed because they
  are no longer necessary.
