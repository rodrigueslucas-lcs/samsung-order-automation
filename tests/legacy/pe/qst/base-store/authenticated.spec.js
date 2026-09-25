import { test } from "@playwright/test";
import authState from "../../../../../utils/authState";
import { annotateQstExecution } from "../../../../../utils/qstExecutionSummary";

const {
  AUTH_STATE_PATH,
  applyAuthSessionStorage,
  hasAuthState,
  validateAuthenticatedSession,
} = authState;

test.describe("QST Base Store - authenticated", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context }) => {
    test.skip(
      !hasAuthState(),
      "Authenticated ST2 state required. Run auth bootstrap first."
    );
    await applyAuthSessionStorage(context);
  });

  test("QST-BS-15 @qst @qst-normal @qst-modified @qst-sanity @base-store - Login via Home Page", async ({ page }, testInfo) => {
    test.setTimeout(150000);
    annotateQstExecution(testInfo, { type: process.env.QST_TYPE, storeType: "Base Store" });
    await validateAuthenticatedSession(page);
  });
});
