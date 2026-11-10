# Samsung SMB — Jenkins Home Views

The Jenkins home is organized with **four managed native List Views**. The existing `Samsung SMB Automation`, `Samsung SMB Quality Summary` and built-in `All` views remain intact.

| View | Jobs | Purpose |
|---|---|---|
| `01 - Overview` | The 8 market/store jobs plus the main automation and authentication operations | Single landing view; focus with the dedicated tabs |
| `02 - Base Store` | `Samsung-SMB-MX`, `Samsung-SMB-PE`, `Samsung-SMB-CL`, `Samsung-SMB-CO` | Base Store functional QST |
| `03 - EPP` | `Samsung-SMB-EPP-MX`, `Samsung-SMB-EPP-PE`, `Samsung-SMB-EPP-CL`, `Samsung-SMB-EPP-CO` | EPP S2 QST |
| `04 - Auth & Ops` | `SAMSUNG-SMB-AUTOMATION`, `Samsung-SMB-Auth-Operations` | Main pipeline and authentication |

The existing `Samsung SMB Quality Summary` view remains the source for the eight-lane reporting overview. Open the Regional Quality Summary published by EPP jobs for executive metrics. Jenkins native List Views do **not** support custom sectioned cards on the stock homepage; grouped tabs are the low-risk approach.

## One-time setup on the Jenkins host

Ensure your local ignored `playwright/.auth/jenkins-publisher.local.json` has the credentials for your *local* Jenkins instance, or provide `JENKINS_URL`, `JENKINS_USER` and `JENKINS_API_TOKEN` as environment variables. Never commit these secrets.

From the repo root in Git Bash:

```bash
node --test governance/tests/jenkinsHomeViews.test.cjs
node scripts/provision-jenkins-home-views.cjs
node scripts/provision-jenkins-home-views.cjs --apply
```

The first provisioner call is a **read-only preview**. The `--apply` command validates all ten job identities and view ownership before posting the four view configurations to Jenkins. It verifies the membership after each creation/update.

Refresh `http://localhost:8080/` to see the ordered navigation tabs. To use `01 - Overview` immediately, click its tab. This script intentionally does **not** change the Jenkins default view; this can be set in the Jenkins UI by an administrator after reviewing the layout.

## Safety contract

- No rename, deletion, reconfiguration or trigger of any Jenkins job.
- No changes to authentication, CAPTCHA, session rotation, payment or Playwright execution.
- No changes to the existing Quality Summary or other pre-existing tabs.
- Any unrecognized existing view name is rejected, rather than overwritten.
- Runs are repeatable. If creation is partially successful, a subsequent invocation rechecks ownership and finishes only the remaining views.
- Reports and Jenkins build results remain authoritative; navigation does not imply quality approval.
