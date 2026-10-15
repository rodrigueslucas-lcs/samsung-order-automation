# Shared staging BackOffice credentials

MX, PE, CO and CL use the same BackOffice Admin credential **within each staging
environment**. S1 and S2 have distinct credentials:

| Environment | Jenkins file credential | Installed runtime file |
| --- | --- | --- |
| S1 | `samsung-mx-s1-backoffice-admin` | `playwright/.auth/backoffice-admin-s1.json` |
| S2 | `samsung-mx-s2-backoffice-admin` | `playwright/.auth/backoffice-admin-s2.json` |

The MX prefix is retained for compatibility. Do not create four copies of the
same environment credential or substitute S2 access for S1.

Local runtime reads the environment-specific ignored file or the supported
`BACKOFFICE_S1_ADMIN_*` / `BACKOFFICE_S2_ADMIN_*` environment variables. Files
contain the `username` and `password` fields; their values must never be committed,
printed or included in build artifacts.

## Publish an approved environment credential

Configure `JENKINS_URL`, `JENKINS_USER` and `JENKINS_API_TOKEN` securely in the local
environment, then run:

```bash
BACKOFFICE_ENV=S1 npm run auth:publish:jenkins:backoffice
```

The publisher accepts only explicit S1/S2 targets and HTTPS Jenkins URLs, with
HTTP allowed only on localhost/127.0.0.1. It uses the Credentials API, without
Script Console access, and creates/updates only the selected environment ID.
The source file can be selected with `BACKOFFICE_ADMIN_CREDENTIALS_FILE`.

The S1 shared credential was created and verified as present on 2026-10-14.
Both PE S1 official BO tests then passed: SAM-25103 search and SAM-25104
`SHIPPING_REQUESTED`. This proves the S1 access locally, not a full Jenkins run.

## Jenkins consumption

Each official market lane binds the selected environment credential and installs
the matching runtime filename before test execution. All four MX auth-source
branches are covered, including S1 session-bundle and S1 legacy-files. CO accepts
both staging environments. S2 preflight behavior is preserved.

Buyer session bundles remain independently scoped by market and environment.
Refreshing/publishing a buyer bundle does not replace the BackOffice credential.
