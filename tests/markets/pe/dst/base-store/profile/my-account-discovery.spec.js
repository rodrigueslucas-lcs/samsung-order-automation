import { test } from "@playwright/test";
import MyAccountPage from "../../../../../../pages/MyAccountPage";
import ProfilePage from "../../../../../../pages/ProfilePage";
import authState from "../../../../../../utils/authState";

const { AUTH_STATE_PATH, applyAuthSessionStorage, hasAuthState, validateAuthenticatedSession } = authState;

test.describe("ST2 - Authenticated My Account route discovery", () => {
  test.use({ storageState: hasAuthState() ? AUTH_STATE_PATH : undefined });

  test.beforeEach(async ({ context, page }) => {
    test.setTimeout(120000);
    test.skip(!hasAuthState(), "Authenticated ST2 state is required.");
    await applyAuthSessionStorage(context);
    await validateAuthenticatedSession(page).catch(() => {
      test.skip(true, "AUTH EXPIRED - MANUAL BOOTSTRAP REQUIRED");
    });
  });

  for (const [name, route] of Object.entries({
    root: "/pe/mypage",
    myproducts: "/pe/mypage/myproducts",
    rewards: "/pe/mypage/rewards",
    orders: "/pe/mypage/orders",
    wishlist: "/pe/mypage/wishlist",
    selectAi: "/pe/campaign/select-ai",
  })) {
    test(`My Account discovery - ${name}`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
      const evidence = await new MyAccountPage(page).inspectRoute(route);
      testInfo.annotations.push({
        type: "my-account-route",
        description: JSON.stringify(evidence),
      });
      await testInfo.attach("my-account-route", {
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
        contentType: "application/json",
      });
    });
  }

  test("My Account discovery - saved addresses API", async ({ page }, testInfo) => {
    const evidence = await new ProfilePage(page).inspectSavedAddressesApi();
    testInfo.annotations.push({
      type: "saved-addresses-api",
      description: JSON.stringify(evidence),
    });
  });
});
