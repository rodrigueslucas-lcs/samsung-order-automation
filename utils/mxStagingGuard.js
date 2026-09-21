const { getMxConfig } = require("./mxConfig");

const PARKING_PATH = /\/onlinestore\/uk\/SystemParking\.html/i;
const MAINTENANCE_TEXT = /SystemParking|Page Under Maintenance|System Maintenance/i;

async function assertMxStagingPage(page, phase = "MX staging navigation") {
  const config = getMxConfig();
  const url = new URL(page.url());
  if (url.protocol !== "https:" || url.hostname !== config.hostname) {
    throw new Error(`${phase}: expected MX ${config.environment} host ${config.hostname}, received ${url.hostname || page.url()}.`);
  }
  if (PARKING_PATH.test(url.pathname)) {
    throw new Error(`${phase}: MX ${config.environment} access session is missing or expired; reached SystemParking.`);
  }
  const maintenance = page.getByText(MAINTENANCE_TEXT).filter({ visible: true }).first();
  if (await maintenance.isVisible().catch(() => false)) {
    throw new Error(`${phase}: MX ${config.environment} returned a maintenance/parking page.`);
  }
  if (!url.pathname.startsWith("/mx/") && url.pathname !== "/mx") {
    throw new Error(`${phase}: expected the MX storefront route, received ${url.pathname}.`);
  }
}

module.exports = { assertMxStagingPage };