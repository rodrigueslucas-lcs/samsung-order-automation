import { expect, test } from "@playwright/test";

import BackOfficeCronJobsPage from "../../../../../pages/BackOfficeCronJobsPage";

import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";

const adminCredentials = {

  username: process.env.BACKOFFICE_ADMIN_USERNAME,

  password: process.env.BACKOFFICE_ADMIN_PASSWORD,

};

let orderCode = process.env.MX_QST_FULFILLMENT_ORDER_CODE || null;

const FINANCIAL_JOB = "mx-tokoFinancialInitialUpdateJob";

const WAREHOUSE_JOB = "mx-tokoTransferConsignmentToWarehouseJob";

const normalizeStatus = (value) =>

  (value || "")

    .replace(/_/g, " ")

    .replace(/\s+/g, " ")

    .trim()

    .toUpperCase();

test.use({

  screenshot: "off",

  video: "off",

  trace: "off",

});

test.describe("MX S1 - QST BackOffice fulfillment", () => {

  test.describe.configure({

    timeout: 300000,

    mode: "serial",

  });

  test.skip(

    (process.env.BACKOFFICE_ENV || "").toLowerCase() !== "s1",

    "MX fulfillment is authorized for S1 only."

  );

  test.skip(

    !adminCredentials.username || !adminCredentials.password,

    "Admin credentials are required at runtime."

  );

  test(

    "MX QST 20 @qst @mx @backoffice @destructive - Financial CronJob",

    async ({ page }) => {

      test.skip(

        process.env.ALLOW_CRONJOB_RUN !== "1",

        "Set ALLOW_CRONJOB_RUN=1 for authorized S1 execution."

      );

      const orders = new BackOfficeOrderPage(page);

      await orders.login({

        ...adminCredentials,

        authority: "admin",

      });

      await orders.openAdminOrders();

      if (!orderCode) {

        const scanned = await orders.scanVisibleAdminOrderStatuses({

          limit: 50,

        });

        const mxOrders = scanned.filter(({ orderCode: code }) =>

          /^MX\d{6}-\d+$/i.test(code || "")

        );

        console.log(

          "MX_QST_DISCOVERY",

          JSON.stringify(mxOrders)

        );

        const waitingOrder = mxOrders.find(

          ({ status }) =>

            normalizeStatus(status) ===

            "WAITING FOR SEND FINANCIAL"

        );

        if (!waitingOrder) {

          throw new Error(

            `No canonical MX order found in WAITING_FOR_SEND_FINANCIAL. Inspected: ${JSON.stringify(

              mxOrders

            )}`

          );

        }

        orderCode = waitingOrder.orderCode;

        console.log(

          "MX_QST_SELECTED_ORDER",

          JSON.stringify({

            orderCode,

            status: waitingOrder.status,

          })

        );

      }

      expect(orderCode).toMatch(/^MX\d{6}-\d+$/i);

      /*

       * scanVisibleAdminOrderStatuses() finishes back on the Orders list,

       * so validate the selected order again immediately before mutation.

       */

      await orders.openAdminOrderByCode(orderCode);

      const beforeStatus = await orders.readOpenAdminOrderStatus(orderCode);

      console.log(

        "MX_QST20_ORDER_BEFORE",

        JSON.stringify({

          orderCode,

          status: beforeStatus,

        })

      );

      expect(normalizeStatus(beforeStatus)).toBe(

        "WAITING FOR SEND FINANCIAL"

      );

      const cronJobs = new BackOfficeCronJobsPage(page);

      await cronJobs.openCronJobs();

      const execution =

        await cronJobs.runCronJobByCode(FINANCIAL_JOB);

      console.log(

        "MX_QST20_CRON_RESULT",

        JSON.stringify({

          orderCode,

          job: FINANCIAL_JOB,

          before: execution.before,

          after: execution.after,

        })

      );

      expect(execution.after.status).toBe("FINISHED");

      expect(execution.after.result).toBe("SUCCESS");

    }

  );

  test(

    "MX QST 20 verification @qst @mx @backoffice @safe - Order Split",

    async ({ page }) => {

      expect(orderCode).toMatch(/^MX\d{6}-\d+$/i);

      const orders = new BackOfficeOrderPage(page);

      await orders.login({

        ...adminCredentials,

        authority: "admin",

      });

      await orders.openAdminOrders();

      await orders.openAdminOrderByCode(orderCode);

      const status = await orders.readOpenAdminOrderStatus(orderCode);

      console.log(

        "MX_QST20_ORDER_AFTER",

        JSON.stringify({

          orderCode,

          status,

        })

      );

      expect(normalizeStatus(status)).toBe("ORDER SPLIT");

    }

  );

  test(

    "MX QST 21 @qst @mx @backoffice @destructive - Warehouse CronJob",

    async ({ page }) => {

      test.skip(

        process.env.ALLOW_CRONJOB_RUN !== "1",

        "Set ALLOW_CRONJOB_RUN=1 for authorized S1 execution."

      );

      expect(orderCode).toMatch(/^MX\d{6}-\d+$/i);

      const orders = new BackOfficeOrderPage(page);

      await orders.login({

        ...adminCredentials,

        authority: "admin",

      });

      await orders.openAdminOrders();

      await orders.openAdminOrderByCode(orderCode);

      const beforeStatus = await orders.readOpenAdminOrderStatus(orderCode);

      console.log(

        "MX_QST21_ORDER_BEFORE",

        JSON.stringify({

          orderCode,

          status: beforeStatus,

        })

      );

      expect(normalizeStatus(beforeStatus)).toBe("ORDER SPLIT");

      const cronJobs = new BackOfficeCronJobsPage(page);

      await cronJobs.openCronJobs();

      const execution =

        await cronJobs.runCronJobByCode(WAREHOUSE_JOB);

      console.log(

        "MX_QST21_CRON_RESULT",

        JSON.stringify({

          orderCode,

          job: WAREHOUSE_JOB,

          before: execution.before,

          after: execution.after,

        })

      );

      expect(execution.after.status).toBe("FINISHED");

      expect(execution.after.result).toBe("SUCCESS");

    }

  );

  test(

    "MX QST 22 @qst @mx @backoffice @safe - Shipping Requested",

    async ({ page }) => {

      expect(orderCode).toMatch(/^MX\d{6}-\d+$/i);

      const orders = new BackOfficeOrderPage(page);

      await orders.login({

        ...adminCredentials,

        authority: "admin",

      });

      await orders.openAdminOrders();

      await orders.openAdminOrderByCode(orderCode);

      const status = await orders.readOpenAdminOrderStatus(orderCode);

      console.log(

        "MX_QST22_ORDER_AFTER",

        JSON.stringify({

          orderCode,

          status,

        })

      );

      expect(normalizeStatus(status)).toBe(

        "SHIPPING REQUESTED"

      );

    }

  );

});

