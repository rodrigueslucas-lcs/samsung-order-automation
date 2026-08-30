import BackOfficePage from "./BackOfficePage";

export default class BackOfficeCronJobsPage extends BackOfficePage {
  async openCronJobs() {
    await this.openTreeRow("System");
    await this.openTreeRow("Background Processes");
    await this.openTreeRow("CronJobs");

    await this.page
      .getByText("CronJobs", { exact: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async searchCronJob(code) {
    const searchInput = this.page
      .getByPlaceholder("Type to search", { exact: true })
      .last();
    await searchInput.waitFor({ state: "visible", timeout: 30000 });
    await searchInput.fill(code);
    await searchInput.locator("xpath=../..").locator('button[title="Search"]').click();

    const result = this.page.getByRole("row", {
      name: new RegExp(`Jobname: ${this.escapeRegExp(code)}(?:,|$)`),
    });
    await result.waitFor({ state: "visible", timeout: 30000 });
    return result;
  }

  async openCronJobByCode(code) {
    const row = await this.searchCronJob(code);
    await row.click();
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, {
      timeout: 30000,
    });
    return { row, state: await this.readCronJobState(row) };
  }

  readCronJobStateFromLabel(label) {
    return {
      status: label?.match(/Current status: ([^,]+)/)?.[1] || null,
      result: label?.match(/Last result: ([^,]+)/)?.[1] || null,
      label: label || "",
    };
  }

  async readCronJobState(row) {
    return this.readCronJobStateFromLabel(await row.getAttribute("aria-label"));
  }

  async runCronJob() {
    const runAction = this.page.locator(
      'button[title="Run CronJob"]:visible'
    );
    await runAction.waitFor({ state: "visible", timeout: 30000 });
    if (await runAction.isDisabled()) {
      throw new Error(
        "Run CronJob is disabled for the selected CronJob and current authority."
      );
    }
    await runAction.click();

    const dialog = this.page.getByRole("dialog", { name: /Run CronJob/i });
    await dialog.waitFor({ state: "visible", timeout: 30000 });
    await dialog.getByRole("button", { name: "Yes", exact: true }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30000 });
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, {
      timeout: 30000,
    });
  }

  async runCronJobByCode(code) {
    const { state: before } = await this.openCronJobByCode(code);
    await this.runCronJob();
    const after = await this.waitForCronJobCompletion(code, {
      previousLabel: before.label,
      executionConfirmed: true,
    });
    return { before, after };
  }

  async waitForCronJobCompletion(
    code,
    { timeout = 180000, previousLabel = null, executionConfirmed = false } = {}
  ) {
    const deadline = Date.now() + timeout;
    let state = null;
    let executionObserved = executionConfirmed || previousLabel === null;
    while (Date.now() < deadline) {
      const row = await this.searchCronJob(code);
      state = await this.readCronJobState(row);
      executionObserved ||=
        state.status === "RUNNING" || state.label !== previousLabel;
      if (executionObserved && state.status === "FINISHED") return state;
      await this.page.waitForTimeout(3000);
    }
    throw new Error(
      `CronJob ${code} did not finish. Last state: ${JSON.stringify(state)}`
    );
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
