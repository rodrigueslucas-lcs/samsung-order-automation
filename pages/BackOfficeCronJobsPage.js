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
      name: new RegExp(`Code: ${this.escapeRegExp(code)}`),
    });
    await result.waitFor({ state: "visible", timeout: 30000 });
    return result;
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
