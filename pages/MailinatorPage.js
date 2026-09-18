import { expect } from "@playwright/test";
import BasePage from "./BasePage";

const KNOWN_SUBJECTS = [/\u00a1Recibimos tu pedido!/i, /\u00a1Pago confirmado!/i];
const OTP_SUBJECT = /Contrase\u00f1a \u00danica de Samsung \(OTP\)|Samsung C[oó]digo de Verificaci[oó]n/i;
const EXPECTED_SENDER = /Customer Services Team|customerservice@shopmail\.samsung\.com/i;

export default class MailinatorPage extends BasePage {
  constructor(page, inbox) {
    super(page);
    this.inbox = inbox;
    this.url = "https://www.mailinator.com/v4/public/inboxes.jsp";
    this.inboxField = page.getByRole("textbox", { name: "inbox field" });
    this.goButton = page.getByRole("button", { name: "GO", exact: true });
  }

  async openInbox() {
    await this.page.goto(this.url, { waitUntil: "domcontentloaded" });
    await this.inboxField.waitFor({ state: "visible", timeout: 30000 });
    await this.inboxField.fill(this.inbox);
    await this.goButton.click();
    await this.page.getByRole("heading", { name: "Public Messages" })
      .waitFor({ state: "visible", timeout: 30000 });
    await expect(this.inboxField).toHaveValue(this.inbox);
  }

  async inboxRows() {
    return this.page.locator("main table tbody tr").filter({
      has: this.page.locator("td"),
    });
  }

  async snapshotInbox() {
    const rows = await this.inboxRows();
    const entries = [];
    for (let index = 0; index < await rows.count(); index++) {
      const text = (await rows.nth(index).innerText()).replace(/\s+/g, " ").trim();
      if (!text || /^From Subject Received$/i.test(text)) continue;
      entries.push(text);
    }
    return entries;
  }

  async snapshotMessageIds() {
    const rows = await this.inboxRows();
    const ids = await rows.evaluateAll((elements) =>
      elements.map((row) => row.id || row.querySelector("a[href*='msgid=']")?.getAttribute("href")).filter(Boolean)
    );
    const otpCount = await rows.filter({ hasText: OTP_SUBJECT }).count();
    return [...ids, `__otp_count__:${otpCount}`];
  }

  async snapshotOtpCodes() {
    const codes = [];
    await this.refreshInbox();
    const count = await (await this.inboxRows()).filter({ hasText: OTP_SUBJECT }).count();

    for (let index = 0; index < count; index++) {
      const rows = (await this.inboxRows()).filter({ hasText: OTP_SUBJECT });
      await rows.nth(index).click();
      await this.page.getByText("Public Message", { exact: true })
        .waitFor({ state: "visible", timeout: 30000 });
      const message = await this.readOpenMessage();
      try {
        codes.push(this.extractOtp(message.bodyText));
      } catch {
        // Ignore malformed historical messages; they cannot identify the new OTP.
      }
      await this.refreshInbox();
    }

    return [...new Set(codes)];
  }

  async refreshInbox() {
    if (!(await this.inboxField.isVisible().catch(() => false))) {
      const back = this.page.getByRole("link", { name: "Back to Inbox" });
      if (await back.isVisible().catch(() => false)) await back.click();
    }
    await this.inboxField.waitFor({ state: "visible", timeout: 30000 });
    await this.inboxField.fill(this.inbox);
    await this.goButton.click();
    await this.page.getByRole("heading", { name: "Public Messages" })
      .waitFor({ state: "visible", timeout: 30000 });
    await expect(this.inboxField).toHaveValue(this.inbox);
  }

  async openCandidate(subjectPattern) {
    const row = this.page.getByRole("row").filter({ hasText: subjectPattern }).first();
    if (!(await row.isVisible().catch(() => false))) return false;
    await row.click();
    await this.page.getByText("Public Message", { exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
    return true;
  }

  async readOpenMessage() {
    const mainText = await this.page.getByRole("main").innerText();
    const frame = this.page.frameLocator('iframe[name="html_msg_body"]');
    const bodyText = await frame.locator("body").innerText({ timeout: 30000 });
    const sender = mainText.match(/From\s+([^\r\n]+)/i)?.[1]?.trim() || "";
    const subject = [...KNOWN_SUBJECTS, OTP_SUBJECT]
      .map((pattern) => bodyText.match(pattern)?.[0] || mainText.match(pattern)?.[0])
      .find(Boolean) || "";
    return { sender, subject, bodyText };
  }

  extractOtp(bodyText) {
    const candidates = [...new Set(bodyText.match(/\b\d{6}\b/g) || [])];
    if (candidates.length !== 1) {
      throw new Error(
        `Expected one unambiguous 6-digit OTP, found ${candidates.length}.`
      );
    }
    return candidates[0];
  }

  async waitForOtpEmail({
    baselineMessageIds = [],
    baselineOtpCodes = [],
    timeoutMs = Number(process.env.MAILINATOR_EMAIL_TIMEOUT_MS || 600000),
    intervalMs = Number(process.env.MAILINATOR_POLL_INTERVAL_MS || 3000),
  } = {}) {
    const startedAt = Date.now();
    const baseline = new Set(baselineMessageIds);
    const priorOtpCodes = new Set(baselineOtpCodes);
    const baselineOtpCount = Number(
      baselineMessageIds.find((value) => value.startsWith("__otp_count__:"))?.split(":")[1] || 0
    );
    let observed = [];

    while (Date.now() - startedAt < timeoutMs) {
      observed = await this.snapshotInbox();
      const rows = await this.inboxRows();
      const otpRows = rows.filter({ hasText: OTP_SUBJECT });
      const otpCount = await otpRows.count();
      const candidateCount = baselineOtpCodes.length > 0
        ? otpCount
        : Math.max(0, otpCount - baselineOtpCount);
      for (let index = 0; index < candidateCount; index++) {
        const row = otpRows.nth(index);
        // Mailinator often renders the message row without an <a href="...msgid=...">.
        // Locator.getAttribute() waits 30s for that absent link on every poll.
        const messageId = await row.evaluate((element) =>
          element.id || element.querySelector("a[href*='msgid=']")?.getAttribute("href") || null
        ) || `otp-row-${index}-of-${otpCount}`;
        if (baseline.has(messageId)) continue;

        await row.click();
        await this.page.getByText("Public Message", { exact: true })
          .waitFor({ state: "visible", timeout: 30000 });
        const message = await this.readOpenMessage();
        const senderMatches =
          EXPECTED_SENDER.test(message.sender) || EXPECTED_SENDER.test(message.bodyText);
        if (!senderMatches || !OTP_SUBJECT.test(message.subject)) {
          await this.refreshInbox();
          continue;
        }

        const otp = this.extractOtp(message.bodyText);
        if (priorOtpCodes.has(otp)) {
          await this.refreshInbox();
          continue;
        }
        await this.screenshot("tc13-mailinator-otp-email");
        return {
          otp,
          sender: message.sender,
          subject: message.subject,
          messageId,
          elapsedMs: Date.now() - startedAt,
          observed,
        };
      }

      await this.page.waitForTimeout(Math.min(intervalMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
      await this.refreshInbox();
    }

    throw new Error(
      `TC13 OTP email was not found within ${timeoutMs}ms. ` +
      `Inbox=${this.inbox}; observed=${JSON.stringify(observed)}`
    );
  }

  async waitForOrderEmail(orderCode, {
    timeoutMs = Number(process.env.MAILINATOR_EMAIL_TIMEOUT_MS || 600000),
    intervalMs = Number(process.env.MAILINATOR_POLL_INTERVAL_MS || 15000),
  } = {}) {
    const startedAt = Date.now();
    let observed = [];

    while (Date.now() - startedAt < timeoutMs) {
      observed = await this.snapshotInbox();
      for (const subjectPattern of KNOWN_SUBJECTS) {
        if (!(await this.openCandidate(subjectPattern))) continue;
        const message = await this.readOpenMessage();
        const senderMatches = EXPECTED_SENDER.test(message.sender) || EXPECTED_SENDER.test(message.bodyText);
        const orderMatches = message.bodyText.includes(orderCode);
        if (senderMatches && orderMatches && message.subject) {
          await this.screenshot("tc63-mailinator-order-email");
          return {
            ...message,
            elapsedMs: Date.now() - startedAt,
            observed,
          };
        }
        await this.refreshInbox();
      }

      await this.page.waitForTimeout(intervalMs);
      await this.refreshInbox();
    }

    throw new Error(
      `TC63 email was not correlated within ${timeoutMs}ms. ` +
      `Inbox=${this.inbox}; order=${orderCode}; observed=${JSON.stringify(observed)}`
    );
  }
}
