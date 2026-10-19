const AEM_PROFILE_KEYS = ["flpe", "dcgue", "encGuid"];

async function preparePreQaCustomerPage(context) {
  const page = await context.newPage();
  try {
    // Reset only AEM's encrypted display-profile cache. WMC and storefront
    // authentication remain in the operator's authorized Chrome context.
    await context.clearCookies({ name: "flpe", domain: /^\.?samsung\.com$|^\.?p6-pre-qa2\.samsung\.com$/i });
    await page.addInitScript(keys => {
      if (location.origin === "https://p6-pre-qa2.samsung.com") {
        for (const key of keys) localStorage.removeItem(key);
      }
    }, AEM_PROFILE_KEYS);
    return page;
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}

module.exports = { preparePreQaCustomerPage };
