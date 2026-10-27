import { test as base, expect } from "@playwright/test";
import eppConfig from "../config/markets/epp";
import eppSession from "./eppSession.cjs";
import evidenceContext from "../reporting/evidence/evidenceContext";
import serverProof from "./eppServerProof.cjs";
import navigationGuard from './eppNavigationGuard.cjs';

function configuration(testInfo) {
  const market = testInfo.file.replace(/\\/g, "/").match(/\/markets\/(mx|pe|co|cl)\/qst\/epp\//)?.[1]?.toUpperCase();
  if (!market || (process.env.TEST_MARKET && process.env.TEST_MARKET !== market)) throw new Error("EPP market ownership does not match the selected runtime.");
  return eppConfig.getEppConfig(market);
}

export const test = base.extend({
  page: async ({ context, eppSession }, use) => {
    const page = await context.newPage();
    await eppSession.protectPage(page);
    await use(page);
  },
  eppLease: [async ({}, use, testInfo) => {
    const lease = eppSession.acquireEppLease(configuration(testInfo));
    try { await use(lease); }
    finally { lease.release(); }
  }, { auto: true }],
  storageState: async ({ eppLease }, use, testInfo) => {
    await use(eppSession.loadEppSession(configuration(testInfo)).storageState);
  },
  eppSession: [async ({ context }, use, testInfo) => {
      const config = configuration(testInfo);
      const market = config.market;
      const session = eppSession.loadEppSession(config);
      const guard = await navigationGuard.installEppNavigationGuard(context,config);
      await eppSession.installEppSessionStorage(context, config, session.sessionStorage);
      const proof = serverProof.watchEppServerProof(context, config);
      const id = testInfo.title.match(/SAM-\d+/)?.[0];
      evidenceContext.recordBusinessEvidence(testInfo, { zephyrId: id, officialTitle: testInfo.title.split(' - ').at(-1), feature: testInfo.title.split(' - ').at(-1), market, store: "EPP", suite: "QST", environment: config.environment });
    try { await use(guard); }
    finally {
      try {
        await proof.settle();
        const page = context.pages().find(candidate => {
          const url = new URL(candidate.url());
          return url.origin === config.rootUrl.origin && url.pathname.startsWith(config.rootUrl.pathname);
        });
        if (proof.accepted() && page) eppSession.persistVerifiedEppSession(config, {
          storageState: await context.storageState(),
          sessionStorage: await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage))),
          proof: proof.snapshot(),
        });
      } finally { proof.stop(); await guard.dispose(); }
    }
  }, { auto: true }],
});
export { expect };
