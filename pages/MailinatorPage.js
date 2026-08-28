import { expect } from "@playwright/test";
import BasePage from "./BasePage";

const KNOWN_SUBJECTS = [/\u00a1Recibimos tu pedido!/i, /\u00a1Pago confirmado!/i];
const OTP_SUBJECT = /Contrase\u00f1a \u00danica de Samsung \(OTP\)/i;
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
    return rows.evaluateAll((elements) =>
      elements.map((row) => row.id).filter(Boolean)
    );
  }

  async refreshInbox() {
    if (!(await this.inboxField.isVisible().catch(() => false))) {
      const back = this.page.getByRole("link", { name: "Back to Inbox" });
      if (await back.isVisible().catch(() => false)) await back.click();
    }
    await this.inboxField.waitFor({ state: "visible", timeout: 30000 });
    await this.inboxField.fill(this.inbox);
    await this.goButton.click();
    await this.page.waitForTimeout(1000);
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
    timeoutMs = Number(process.env.MAILINATOR_EMAIL_TIMEOUT_MS || 600000),
    intervalMs = Number(process.env.MAILINATOR_POLL_INTERVAL_MS || 15000),
  } = {}) {
    const startedAt = Date.now();
    const baseline = new Set(baselineMessageIds);
    let observed = [];

    while (Date.now() - startedAt < timeoutMs) {
      observed = await this.snapshotInbox();
      const rows = await this.inboxRows();
      const otpRows = rows.filter({ hasText: OTP_SUBJECT });
      for (let index = 0; index < await otpRows.count(); index++) {
        const row = otpRows.nth(index);
        const messageId = await row.getAttribute("id");
        if (!messageId || baseline.has(messageId)) continue;

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

      await this.page.waitForTimeout(intervalMs);
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
