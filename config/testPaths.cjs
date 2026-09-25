const path = require('node:path');

// Canonical executable test locations. Environment (S1/S2) is intentionally
// absent from physical paths; it is selected through runtime configuration.
const TEST_PATHS = Object.freeze({
  mx: Object.freeze({
    root: 'tests/markets/mx',
    qst: 'tests/markets/mx/qst',
    qstBaseStore: 'tests/markets/mx/qst/base-store',
    dst: 'tests/markets/mx/dst',
    dstBaseStore: 'tests/markets/mx/dst/base-store',
    dstBackoffice: 'tests/markets/mx/dst/backoffice',
  }),
  pe: Object.freeze({
    root: 'tests/markets/pe',
    qst: 'tests/markets/pe/qst',
    qstBaseStore: 'tests/markets/pe/qst/base-store',
    dst: 'tests/markets/pe/dst',
    dstBaseStore: 'tests/markets/pe/dst/base-store',
    dstEpp: 'tests/markets/pe/dst/epp',
    dstBackoffice: 'tests/markets/pe/dst/backoffice',
  }),
  legacy: Object.freeze({
    peQst: 'tests/legacy/pe/qst',
    peQstBaseStore: 'tests/legacy/pe/qst/base-store',
    peQstEpp: 'tests/legacy/pe/qst/epp',
  }),
  shared: Object.freeze({
    smbQst: 'tests/shared/smb/qst',
    smbQstBaseStore: 'tests/shared/smb/qst/base-store',
    smbQstBackoffice: 'tests/shared/smb/qst/backoffice',
  }),
});

function resolveTestPath(value) {
  return path.resolve(value);
}

module.exports = { TEST_PATHS, resolveTestPath };
