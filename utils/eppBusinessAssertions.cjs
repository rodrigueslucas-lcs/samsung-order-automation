const { expect } = require('@playwright/test');

function getEppCartTextPatterns(market) {
  return market==='CL' ? {
    cartPageTitlePattern:/Tienes\s+\d+\s+productos?\s+en\s+tu\s+carro/i,
    orderSummaryPattern:/^Resumen$/i,
  } : {
    cartPageTitlePattern:/Tienes \d+ productos? en tu carrito|Tu carrito|Carrito de compra|Shopping cart/i,
    orderSummaryPattern:/Resumen de (?:la orden|tu pedido)|Order summary/i,
  };
}

function assertStoreRoute(value, config, route) {
  const url = new URL(value);
  if (url.origin !== config.rootUrl.origin || !url.pathname.startsWith(config.rootUrl.pathname) ||
      (route && !route.test(url.pathname.slice(config.rootUrl.pathname.length)))) {
    throw new Error('EPP business flow left its configured staging multistore or expected step.');
  }
  return url;
}

async function proveCheckout(page, config) {
  await expect.poll(() => {
    const url = new URL(page.url());
    return url.origin === config.rootUrl.origin && url.pathname.startsWith(config.rootUrl.pathname) &&
      /^checkout\//.test(url.pathname.slice(config.rootUrl.pathname.length));
  }, { timeout: 30000 }).toBe(true);
  assertStoreRoute(page.url(), config, /^checkout\//);
  await expect(page.locator('input[name="firstName"], input[formcontrolname="firstName"], input[name="address1"], input[formcontrolname="address1"]').filter({ visible: true }).first()
    .or(page.getByText(/Datos de contacto|Informaci[oó]n de contacto|Direcci[oó]n de entrega|M[eé]todo de entrega/i).filter({ visible: true }).first()).first()).toBeVisible();
}

async function proveFilterEffect(page, config) {
  assertStoreRoute(page.url(), config);
  const cards = page.locator('.product-card, cx-product-list-item, cx-product-grid-item, [data-component="product-card"]').filter({ visible: true });
  await expect(cards.first()).toBeVisible({ timeout: 30000 });
  const signature = () => cards.evaluateAll(nodes => nodes.map(node => node.querySelector('a[href*="/p/"]')?.getAttribute('href') || node.textContent.trim()).sort().join('\n'));
  const before = await signature();
  const facets = page.locator('cx-facet, [data-component="facet"], .facet');
  const choice = facets.getByRole('checkbox').filter({ visible: true }).first();
  await expect(choice).toBeVisible();
  if (await choice.isChecked()) throw new Error('EPP filter requires an initially unselected facet.');
  await choice.check();
  await expect(choice).toBeChecked();
  await expect.poll(signature, { timeout: 30000 }).not.toBe(before);
  await expect(cards.first()).toBeVisible();
  assertStoreRoute(page.url(), config);
}

async function provePdpVariantSelection(page, config, {timeout=30000}={}) {
  const before=assertStoreRoute(page.url(),config,/^p\//);
  const beforeSku=decodeURIComponent(before.pathname.split('/').filter(Boolean).at(-1));
  await expect(page.getByRole('main').getByText(beforeSku,{exact:true}).first()).toBeVisible();
  const controls=page.locator('main button.bttn, main [role="radio"]').filter({visible:true});
  let choice;
  for(let i=0;i<await controls.count();i++) {
    const item=controls.nth(i), classes=await item.getAttribute('class')||'';
    const selected=/\bselected\b/.test(classes)||await item.getAttribute('aria-checked')==='true';
    if(!selected&&await item.isEnabled()){choice=item;break;}
  }
  if(!choice) throw Object.assign(new Error('PDP lacks an alternate selectable variant.'),{eppReason:'MISSING_OR_UNPROVEN_EPP_PRODUCT'});
  const label=(await choice.innerText()).trim();
  await choice.click();
  await expect.poll(()=>new URL(page.url()).pathname,{timeout}).not.toBe(before.pathname);
  const after=assertStoreRoute(page.url(),config,/^p\//), sku=decodeURIComponent(after.pathname.split('/').filter(Boolean).at(-1));
  if(sku===beforeSku)throw new Error('PDP variant did not change its product identity.');
  await expect(page.getByRole('main').getByText(sku,{exact:true}).first()).toBeVisible({timeout});
  await expect.poll(()=>page.locator('main button.bttn.selected, main [role="radio"][aria-checked="true"]').evaluateAll(es=>es.map(e=>e.textContent.trim())),{timeout}).toContain(label);
  return {beforeSku,sku,label};
}

async function chooseConfiguredPdpFromPlp(page, config) {
  assertStoreRoute(page.url(), config);
  const links = page.locator('a[href]').filter({ visible: true });
  let chosen;
  for (let i = 0; i < await links.count(); i++) {
    const href = new URL(await links.nth(i).getAttribute('href'), page.url());
    if (href.origin === config.pdpUrl.origin && href.pathname === config.pdpUrl.pathname) { chosen = links.nth(i); break; }
  }
  if (!chosen) throw new Error('The configured EPP product/variant is not offered by this PLP.');
  await chosen.click();
  await expect(page).toHaveURL(url => url.origin === config.pdpUrl.origin && url.pathname === config.pdpUrl.pathname);
  assertStoreRoute(page.url(), config, /^p\//);
  // The configured SKU identifies the chosen variant, rather than accepting
  // an arbitrary/default variant from a different PLP card.
  await expect(page.getByText(config.sku, { exact: true }).filter({ visible: true }).first()).toBeVisible();
}

async function proveTooltipAboveBackToTop(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const back = page.getByRole('button', { name: /Back to top|Volver al inicio|Volver arriba|Ir arriba|Subir/i })
    .or(page.getByRole('link', { name: /Back to top|Volver al inicio|Volver arriba|Ir arriba|Subir/i })).filter({ visible: true }).first();
  await expect(back).toBeVisible({ timeout: 15000 });
  const tooltip = page.getByRole('tooltip').filter({ visible: true }).first();
  if (!(await tooltip.isVisible())) {
    const trigger = page.getByRole('img', { name: 'service-item-title-tooltip', exact: true })
      .or(page.locator('[aria-describedby], [mattooltip], [ng-reflect-message]')).filter({ visible: true }).last();
    await expect(trigger).toBeVisible();
    await trigger.hover();
  }
  await expect(tooltip).toBeVisible();
  const backHandle = await back.elementHandle();
  const result = await tooltip.evaluate((tip, control) => {
    const a = tip.getBoundingClientRect(), b = control.getBoundingClientRect();
    const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) {
      // "Behind" is a stacking requirement, not a requirement that the two
      // rectangles intersect on every viewport. Compare explicit sibling
      // stacking contexts; never manufacture an overlap by moving either UI.
      const contexts = node => {
        const result = [];
        for (let current = node; current; current = current.parentElement) {
          const style = getComputedStyle(current);
          const positioned = style.position !== 'static' && style.zIndex !== 'auto';
          if (positioned || ['fixed','sticky'].includes(style.position) || style.transform !== 'none' || Number(style.opacity) < 1 || style.isolation === 'isolate') result.unshift({ node: current, z: style.zIndex === 'auto' ? 0 : Number(style.zIndex) });
        }
        return result;
      };
      const tips = contexts(tip), backs = contexts(control);
      while (tips.length && backs.length && tips[0].node === backs[0].node) { tips.shift(); backs.shift(); }
      return { overlap: false, tooltipOnTop: !!tips.length && !!backs.length && tips[0].z > backs[0].z };
    }
    const stack = document.elementsFromPoint((left + right) / 2, (top + bottom) / 2);
    const tipIndex = stack.findIndex(node => node === tip || tip.contains(node));
    const backIndex = stack.findIndex(node => node === control || control.contains(node));
    return { overlap: true, tooltipOnTop: tipIndex >= 0 && (backIndex < 0 || tipIndex < backIndex) };
  }, backHandle);
  await backHandle.dispose();
  expect(result.tooltipOnTop, 'Official EPP expected result requires Back to Top behind the visible tooltip').toBe(true);
}

async function completeContact(page, config, customer) {
  assertStoreRoute(page.url(), config, /^checkout\//);
  const field = name => page.locator(`input[name="${name}"], input[formcontrolname="${name}"]`).filter({ visible: true }).first();
  const email = field('email');
  await expect(email).toBeVisible();
  if (config.market === 'MX') expect(await email.inputValue(), 'Registered MX contact must prefill email').toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  else if (!(await email.inputValue())) {
    if (!customer.email) throw new Error('EPP contact fixture requires an email.');
    await email.fill(customer.email);
  }
  for (const name of ['firstName', 'lastName', 'phone']) {
    if (!customer[name]) throw new Error('EPP contact fixture is incomplete.');
    await field(name).fill(customer[name]);
    await expect(field(name)).toHaveValue(customer[name]);
  }
  if (config.market === 'CO') {
    if (!customer.documentType || !customer.documentNumber) throw new Error('CO EPP document fixture is missing.');
    await page.getByRole('combobox', { name: /Tipo de documento/i }).click();
    await page.getByRole('option', { name: customer.documentType, exact: true }).click();
    await field('vatNumber').fill(customer.documentNumber);
  }
  const groups = page.getByRole('radiogroup').filter({ visible: true });
  for (let i = 0; i < await groups.count(); i++) {
    const radios = groups.nth(i).getByRole('radio');
    if (!(await radios.evaluateAll(nodes => nodes.some(node => node.checked || node.getAttribute('aria-checked') === 'true')))) await radios.first().check();
  }
  const terms = page.getByRole('checkbox', { name: /t[eé]rminos|privacidad/i }).filter({ visible: true });
  for (let i = 0; i < await terms.count(); i++) await terms.nth(i).check();
  const next = page.getByRole('button', { name: /^Continuar$|Continuar al m[eé]todo de entrega|Continue to Delivery/i }).filter({ visible: true }).first();
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('step'), { timeout: 30000 }).toBe('CHECKOUT_STEP_DELIVERY');
  assertStoreRoute(page.url(), config, /^checkout\//);
}

module.exports = { getEppCartTextPatterns, assertStoreRoute, proveCheckout, proveFilterEffect, provePdpVariantSelection, chooseConfiguredPdpFromPlp, proveTooltipAboveBackToTop, completeContact };
