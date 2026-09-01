import MailinatorPage from "../../../../pages/MailinatorPage";
import { test, expect } from "./mx.fixture";

test("MX TC64 @dst @mx @base-store - Order email correlates to current QA order", async ({ page }) => {
  test.setTimeout(360000);
  const orderCode = process.env.MX_ORDER_CODE;
  const inbox = process.env.MAILINATOR_INBOX;
  test.skip(!orderCode || !inbox, "MX_ORDER_CODE and MAILINATOR_INBOX are required.");
  const mailinator = new MailinatorPage(page, inbox);
  await mailinator.openInbox();
  const message = await mailinator.waitForOrderEmail(orderCode, {
    timeoutMs: Number(process.env.MAILINATOR_EMAIL_TIMEOUT_MS || 300000),
    intervalMs: 15000,
  });
  expect(message.sender).toMatch(/Customer Services Team|customerservice@shopmail\.samsung\.com/i);
  expect(message.bodyText).toContain(orderCode);
  console.log("MX_ORDER_EMAIL", JSON.stringify({
    sender: message.sender,
    subject: message.subject,
    orderCode,
    elapsedMs: message.elapsedMs,
  }));
});
