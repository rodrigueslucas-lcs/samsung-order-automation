# PE DST — Established Compatibility Path

This tree contains the established Peru Detailed Smoke Test automation and is still directly referenced by `package.json` DST commands.

It is active compatibility code, not a deletion candidate.

The `s2` path reflects the original ST2 implementation. The target architecture is `tests/pe/dst/...`, with environment selected at runtime where behavior supports parity.

Any migration must preserve Base Store, EPP and BackOffice coverage and update package scripts/imports atomically before the old path is removed.
