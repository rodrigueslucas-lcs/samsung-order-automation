import { test as base, expect } from "@playwright/test";
import mxConfigModule from "../../../../utils/mxConfig";

const { getMxConfig } = mxConfigModule;

export const test = base.extend({
  mxConfig: async ({}, use) => {
    await use(getMxConfig());
  },
});

export { expect };
