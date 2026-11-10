// Shared presentation contract; executable UI lives in the scoped Jenkins portlet.
// No global HTML formatter or CSP exception is needed for V2.
const ui = require('./assets/control-center.js');
module.exports = {
  jobs: ui.jobs,
  labels: ui.labels,
  nav: ui.nav,
  base: ui.jobs.slice(0, 4),
  epp: ui.jobs.slice(4, 8),
  operations: ui.jobs.slice(8),
};
