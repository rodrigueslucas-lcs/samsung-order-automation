function sameOrigin(left, right) {
  return new URL(left).origin === new URL(right).origin;
}

async function openStorefront(page, { baseUrl, setupUrl = null, expectedMarket }) {
  const marketUrl = new URL(baseUrl);
  if (marketUrl.protocol !== "https:") {
    throw new Error("SMB storefront URL must use https.");
  }

  const expectedPrefix = `/${String(expectedMarket || "").toLowerCase()}/`;
  if (!expectedPrefix || !marketUrl.pathname.toLowerCase().startsWith(expectedPrefix)) {
    throw new Error(
      `SMB storefront URL ${marketUrl.href} does not match market ${expectedMarket}.`
    );
  }

  if (setupUrl) {
    const setup = new URL(setupUrl);
    if (setup.protocol !== "https:") {
      throw new Error("SMB storefront setup URL must use https.");
    }
    if (!sameOrigin(setup, marketUrl)) {
      throw new Error("SMB storefront setup URL must use the same origin as the market storefront.");
    }
    await page.goto(setup.href, { waitUntil: "domcontentloaded", timeout: 60000 });
  }

  await page.goto(marketUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });

  const loaded = new URL(page.url());
  if (loaded.hostname !== marketUrl.hostname) {
    throw new Error(
      `SMB storefront redirected to unexpected host ${loaded.hostname}; expected ${marketUrl.hostname}.`
    );
  }
  if (!loaded.pathname.toLowerCase().startsWith(expectedPrefix)) {
    throw new Error(
      `SMB storefront did not remain in ${expectedPrefix}; final URL was ${loaded.href}.`
    );
  }

  return loaded;
}

module.exports = { openStorefront };
