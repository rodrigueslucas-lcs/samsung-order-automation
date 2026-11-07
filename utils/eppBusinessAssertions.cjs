const { expect } = require('@playwright/test');
const { continueMxContactToDelivery } = require('./mxContactTransition.cjs');

function getEppCartTextPatterns(market) {
  if(market==='CO')return {
    cartPageTitlePattern:/Tienes\s+\d+\s+Producto(?:\(s\)|s)?\s+en\s+tu\s+carrito/i,
    orderSummaryPattern:/^(?:Resumen|Resumen de la orden|Resumen de tu pedido)$/i,
    summaryProductPattern:/\b\d+\s+Producto(?:\(s\)|s)?\b/i,
  };
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
  if(config.market==='CL'){
    // Registered CL can enter Delivery directly with Contact collapsed.
    // Its template uses cliente/despacho, not the other markets' labels.
    await expect(page.getByRole('heading',{name:/^(?:[12]\.\s*)?(?:Datos del cliente|Informaci[oó]n de despacho)$/i}).filter({visible:true}).first()).toBeVisible({timeout:30000});
    return;
  }
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
  // Purchase/gallery actions can share .bttn with variant controls. Never
  // mutate the cart while proving a variant selection.
  const controls=page.locator('main button.bttn, main [role="radio"]').filter({visible:true})
    .filter({hasNotText:/^(?:Agregar al carrito|A[nñ]adir al carrito|Comprar(?: ahora)?|Add to cart|Buy(?: now)?|Preventa|Previous|Next|A[nñ]adir a la lista de deseos)$/i});
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
    if(await trigger.count()===0)throw Object.assign(new Error('The cart has no tooltip trigger for the official stacking scenario.'),{code:'EPP_TOOLTIP_TRIGGER_NOT_AVAILABLE'});
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
      // A node without a remaining stacking context paints in the common
      // context at level zero. Requiring both chains rejects normal-flow
      // controls even when the tooltip has a proven positive stacking level.
      return { overlap: false, tooltipOnTop: (tips[0]?.z ?? 0) > (backs[0]?.z ?? 0), tooltipContexts:tips.map(x=>x.z), controlContexts:backs.map(x=>x.z) };
    }
    const stack = document.elementsFromPoint((left + right) / 2, (top + bottom) / 2);
    const tipIndex = stack.findIndex(node => node === tip || tip.contains(node));
    const backIndex = stack.findIndex(node => node === control || control.contains(node));
    return { overlap: true, tooltipOnTop: tipIndex >= 0 && (backIndex < 0 || tipIndex < backIndex),tipIndex,backIndex };
  }, backHandle);
  await backHandle.dispose();
  expect(result.tooltipOnTop, 'Official EPP expected result requires Back to Top behind the visible tooltip: '+JSON.stringify(result)).toBe(true);
}

async function waitForEppContactEmail(page,config,{timeout=30000}={}){
  const email=page.locator('input[name="email"], input[formcontrolname="email"]').filter({visible:true}).first();
  try{await expect(email).toBeVisible({timeout});}
  catch(error){
    const savedMxContact=config.market==='MX'&&config.environment==='S2'&&config.program==='pymesmx'
      &&new URL(page.url()).searchParams.get('step')==='CHECKOUT_STEP_DELIVERY'
      &&await page.getByRole('tab',{name:/^1\.\s*Información de contacto\b/i}).filter({visible:true}).count()===1;
    if(savedMxContact){
      // Registered checkout may resume Delivery with Contact already collapsed.
      // Reopen the canonical Contact GET, then prove/fill the real form below.
      // Never substitute a saved summary for the official field assertions.
      assertStoreRoute(page.url(),config,/^checkout\//);
      await page.goto(new URL('checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',config.rootUrl).href,{waitUntil:'domcontentloaded',timeout:60000});
      assertStoreRoute(page.url(),config,/^checkout\//);
      await expect(email).toBeVisible({timeout});
      return email;
    }
    const panel=page.getByRole('region',{name:config.market==='MX'?/^1\.\s*Información de contacto$/i:/^1\.\s*Detalles del cliente$/i});
    const observedProgramme=config.market==='CO'&&config.program==='co_epp_agre'||config.market==='MX'&&config.program==='pymesmx';
    const skeleton=observedProgramme&&config.environment==='S2'&&new URL(page.url()).searchParams.get('step')==='CHECKOUT_STEP_CONTACT_INFO'&&await panel.count()===1&&await panel.locator('input').count()===0&&await page.getByRole('alert').filter({visible:true}).count()===0;
    if(!skeleton)throw error;
    // No field has been filled/submitted. Recover only this empty GET view.
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    assertStoreRoute(page.url(),config,/^checkout\//);
    await expect(email).toBeVisible({timeout});
  }
  return email;
}

async function completeContact(page, config, customer) {
  assertStoreRoute(page.url(), config, /^checkout\//);
  const field = name => page.locator(`input[name="${name}"], input[formcontrolname="${name}"]`).filter({ visible: true }).first();
  const email = await waitForEppContactEmail(page,config);
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
    const naturalPerson=page.getByRole('checkbox',{name:'Persona Natural',exact:true});
    if(await naturalPerson.isVisible())await naturalPerson.check();
  }
  const groups = page.getByRole('radiogroup').filter({ visible: true });
  for (let i = 0; i < await groups.count(); i++) {
    const radios = groups.nth(i).getByRole('radio');
    if (!(await radios.evaluateAll(nodes => nodes.some(node => node.checked || node.getAttribute('aria-checked') === 'true')))) await radios.first().check();
  }
  const terms = page.getByRole('checkbox', { name: /t[eé]rminos|privacidad/i }).filter({ visible: true });
  for (let i = 0; i < await terms.count(); i++) await terms.nth(i).check();
  const next = page.getByRole('button', { name: /^Continuar$|Continuar al m[eé]todo de entrega|Continuar con el m[eé]todo de env[ií]o|Continue to Delivery/i }).filter({ visible: true }).first();
  await expect(next).toBeEnabled();
  if(config.market==='CO'&&config.environment==='S2'&&config.program==='co_epp_agre')await continueCoEppContactToDelivery(page,next,config);
  else if(config.market==='MX'&&config.environment==='S2'&&config.program==='pymesmx')await continueMxContactToDelivery(page,next,{storefront:config});
  else{
    await next.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('step'), { timeout: 30000 }).toBe('CHECKOUT_STEP_DELIVERY');
  }
  assertStoreRoute(page.url(), config, /^checkout\//);
}

async function continueCoEppContactToDelivery(page,next,config,{timeout=120000,now=Date.now}={}){
 const current=assertStoreRoute(page.url(),config,/^checkout\/one$/);
 const expected='https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/checkout/one';
 if(config.market!=='CO'||config.environment!=='S2'||config.program!=='co_epp_agre'||current.origin+current.pathname!==expected||current.searchParams.get('step')!=='CHECKOUT_STEP_CONTACT_INFO')throw new Error('CO EPP contact transition requires its exact S2 programme Contact route.');
 const deadline=now()+timeout,remaining=()=>Math.max(1,deadline-now());
 const updated=page.waitForResponse(response=>{
  const url=new URL(response.url());
  return response.request().method()==='POST'&&url.origin==='https://s2-smb-api-cdn.ecom-stg.samsung.com'&&url.pathname==='/tokocommercewebservices/v2/co_epp_agre/users/current/carts/current/checkout/update';
 },{timeout:remaining()});
 updated.catch(()=>{});
 await next.click({timeout:Math.min(15000,remaining())});
 const response=await updated;
 if(!response.ok())throw new Error(`CO EPP Contact returned HTTP ${response.status()}; no second submit.`);
 let timer;
 try{
  const failure=await Promise.race([response.finished(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('CO EPP Contact body deadline exceeded; no second submit.')),remaining());})]);
  if(failure)throw new Error('CO EPP Contact response was interrupted; no second submit.');
 }finally{clearTimeout(timer);}
 await page.waitForURL(url=>url.origin===current.origin&&url.pathname===current.pathname&&url.searchParams.get('step')==='CHECKOUT_STEP_DELIVERY',{waitUntil:'commit',timeout:remaining()});
 await page.getByRole('tab',{name:/^Entrega$|^Recoge$/i}).first().waitFor({state:'visible',timeout:remaining()});
}


async function waitForPeRegisteredCheckout(page,continueButton,{timeout=15000}={}){
 const express=page.getByRole('button',{name:/^Samsung Checkout Express$/i});
 const guest=page.getByRole('button',{name:/^Checkout como invitado$/i});
 let registered=false;
 await expect.poll(async()=>{
  registered=await continueButton.isVisible();
  return registered||(await express.isVisible()&&await guest.isVisible());
 },{timeout}).toBe(true);
 return registered;
}

module.exports = { continueCoEppContactToDelivery, waitForPeRegisteredCheckout, getEppCartTextPatterns, assertStoreRoute, proveCheckout, proveFilterEffect, provePdpVariantSelection, chooseConfiguredPdpFromPlp, proveTooltipAboveBackToTop, waitForEppContactEmail, completeContact };
