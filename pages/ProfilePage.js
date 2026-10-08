import { expect } from "@playwright/test";
import MyAccountPage from "./MyAccountPage";

const LEGACY_PE_ST2_ADDRESS_API =
  "https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/addresses";
const ADDRESS_API_TIMEOUT_MS = Number(process.env.PROFILE_ADDRESS_API_TIMEOUT_MS || 15000);

export default class ProfilePage extends MyAccountPage {
  constructor(page, options = {}) {
    super(page, options);
    this.profileButton = page.getByRole("button", { name: "My Profile", exact: true });
    this.qaMarker = "QA AUTOMATION";
    this.addressApiUrl = options.addressApiUrl || LEGACY_PE_ST2_ADDRESS_API;
    this.addressCards = this.market === "pe"
      ? page.getByRole("tabpanel", { name: "Envío" }).getByRole("listitem")
      : this.market === "cl"
        ? page.locator('button[data-an-la="address:edit"]').locator('xpath=../..')
        : page.locator('article, [class*="address-card" i], [class*="address-item" i], [data-testid*="address" i]');
  }

  assertAddressApiUrl() {
    const url = new URL(this.addressApiUrl);
    if (url.protocol !== "https:") {
      throw new Error("Profile address API must use https.");
    }
    if (!/\/users\/current\/addresses$/.test(url.pathname)) {
      throw new Error(`Unexpected profile address API path: ${url.pathname}`);
    }
    return url.href;
  }

  async requestAddressApi(method, url) {
    const request = this.page.context().request;
    const action = method === "DELETE" ? request.delete.bind(request) : request.get.bind(request);
    try {
      return await action(url, {
        failOnStatusCode: false,
        timeout: ADDRESS_API_TIMEOUT_MS,
      });
    } catch (error) {
      throw new Error(
        `Profile address API ${method} did not complete within ${ADDRESS_API_TIMEOUT_MS}ms: ${error?.message || error}`
      );
    }
  }

  async openProfileMenu() {
    await this.profileButton.waitFor({ state: "visible", timeout: 60000 });
    await this.profileButton.click();
    await this.page.getByText("Cerrar sesión", { exact: true })
      .filter({ visible: true })
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async validateAuthenticatedMenu() {
    await this.openProfileMenu();
    const logout = this.page.getByText("Cerrar sesión", { exact: true })
      .filter({ visible: true });
    await expect(logout).toBeVisible();
    return {
      profile: await this.page.getByText(/Mi perfil|Perfil|My Profile/i)
        .filter({ visible: true }).count() +
        await this.page.getByRole("menuitem", { name: "Mi cuenta", exact: true }).count(),
      orders: await this.page.getByText(/Mis pedidos|Pedidos|My Orders/i)
        .filter({ visible: true }).count(),
    };
  }

  async openProfile() {
    await this.openRoute(this.routes.root);
  }

  async openAddressManagement() {
    if (this.market === "cl") {
      const addAddress = this.page.locator('button[data-an-la="address:add"]');
      if (await addAddress.isVisible().catch(() => false)) return;
      const target = new URL(`/${this.market}/mypage/profile-setting`, this.origin).href;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await this.page.goto(target, { waitUntil: "commit", timeout: 60000 });
        this.assertStagingUrl();
        if (await addAddress.waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false)) return;
      }
      throw new Error(`CL profile-setting did not render address controls after 3 navigations; url=${this.page.url()}`);
    }
    if (this.market === "pe") {
      await this.openRoute(`/${this.market}/mypage/profile-setting`);
      await this.page.getByRole("heading", { name: /Configuraci[oó]n de Perfil/i })
        .waitFor({ state: "visible", timeout: 60000 });
      await this.page.getByText("Direcciones", { exact: true }).first()
        .waitFor({ state: "visible", timeout: 30000 });
      return;
    }
    await this.openProfile();

    const addressEntry = () => this.page
      .getByRole("link", { name: /Mis direcciones|Direcciones|Address/i })
      .or(this.page.getByRole("button", { name: /Mis direcciones|Direcciones|Address/i }))
      .or(this.page.locator('a[href*="address" i], a[href*="direccion" i]'))
      .filter({ visible: true })
      .first();

    let entry = addressEntry();
    if (!(await entry.isVisible().catch(() => false))) {
      // Some PE S2 My Page variants expose address management only from the
      // authenticated profile menu rather than directly in the page body.
      await this.openProfileMenu();
      entry = addressEntry();
    }

    await entry.waitFor({ state: "visible", timeout: 30000 });
    await entry.click();
    await this.page.getByText(/Mis direcciones|Direcciones|Address/i).first()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async listSavedAddresses() {
    await this.openAddressManagement();
    return this.addressCards.allInnerTexts();
  }

  async inspectSavedAddressesApi() {
    const endpoint = this.assertAddressApiUrl();
    const response = await this.requestAddressApi("GET", endpoint);
    const evidence = {
      endpoint,
      status: response.status(),
      count: null,
      shape: [],
    };
    if (!response.ok()) return evidence;
    const payload = await response.json();
    const addresses = Array.isArray(payload) ? payload : payload.addresses || [];
    evidence.count = addresses.length;
    evidence.shape = [...new Set(addresses.flatMap((address) => Object.keys(address)))]
      .filter((key) => !/token|email|phone|name|line|formatted|id/i.test(key))
      .slice(0, 20);
    return evidence;
  }

  async waitForQaAddressViaApi(marker, { attempts = 10, intervalMs = 3000 } = {}) {
    if (!marker.startsWith(this.qaMarker)) {
      throw new Error("Refusing API lookup for a non-QA address.");
    }
    const endpoint = this.assertAddressApiUrl();
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const response = await this.requestAddressApi("GET", endpoint);
      if (!response.ok()) {
        throw new Error(`Address readback returned HTTP ${response.status()}.`);
      }
      const payload = await response.json();
      const addresses = Array.isArray(payload) ? payload : payload.addresses || [];
      const found = addresses.some((address) =>
        [address.line1, address.line2, address.formattedAddress, address.addressName]
          .filter(Boolean)
          .some((value) => String(value).includes(marker)),
      );
      if (found) return { found: true, attempt };
      if (attempt < attempts) await this.page.waitForTimeout(intervalMs);
    }
    throw new Error("QA address saved from Checkout was not returned by the authenticated address API.");
  }

  qaAddress(marker, baseAddress) {
    return {
      ...baseAddress,
      street: `${this.qaMarker} ${marker}`,
      number: `TC ${marker}`,
    };
  }

  async createQaAddress(address) {
    if (!address.street.startsWith(this.qaMarker)) {
      throw new Error("Refusing to create an address without the QA AUTOMATION marker.");
    }
    await this.openAddressManagement();
    const add = this.market === "cl"
      ? this.page.locator('button[data-an-la="address:add"]')
      : this.market === "pe"
      ? this.page.getByRole("heading", { name: "Direcciones" }).locator("xpath=..").getByRole("button")
      : this.page.getByRole("button", { name: /Agregar|Añadir|Nueva dirección|Add address/i });
    await add.click();
    await this.fillAddressForm(address);
    const save = this.market === "cl"
      ? this.page.getByRole("dialog", { name: /Agregar nueva direcci[oó]n/i }).getByRole("button", { name: "Guardar", exact: true })
      : this.page.getByRole("button", { name: /Guardar|Save/i });
    if (this.market === "cl" && !(await save.isEnabled())) {
      const invalid = await this.page.getByRole("dialog", { name: /Agregar nueva direcci[oó]n/i })
        .locator('[formcontrolname].ng-invalid').evaluateAll((elements) => elements.map((element) => ({
          field: element.getAttribute("formcontrolname"),
          length: String(element.value || "").length,
          pattern: element.getAttribute("pattern"),
          maxlength: element.getAttribute("maxlength"),
          error: element.closest("mat-form-field")?.querySelector("mat-error")?.textContent?.trim() || "",
        })));
      throw new Error(`CL address form rejected QA data; invalid fields=${JSON.stringify(invalid)}`);
    }
    await save.click();
    if (this.market === "cl") {
      await expect(this.page.locator("app-address-form-dialog")).toBeHidden({ timeout: 30000 });
      await this.expectQaAddress(address.street);
      return;
    }
    if (this.market === "pe") {
      await expect(this.page.getByRole("dialog", { name: "Añadir nueva dirección" }).first()).toBeHidden({ timeout: 30000 });
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await expect(this.page.getByRole("heading", { name: "Configuración de Perfil" })).toBeVisible();
    }
    if (this.market !== "pe") await this.expectAddressNotification(/agreg|cread|guardad|success/i);
    await this.expectQaAddress(address.street);
  }

  async editQaAddress(currentMarker, updatedAddress) {
    const card = await this.qaCard(currentMarker);
    await card.getByRole("button", { name: /Editar|Edit/i }).click();
    await this.fillAddressForm(updatedAddress);
    await (this.market === "cl"
      ? this.page.getByRole("dialog", { name: /Editar direcci[oó]n/i }).last().getByRole("button", { name: "Guardar", exact: true })
      : this.page.getByRole("button", { name: /Guardar|Actualizar|Save|Update/i })).click();
    if (this.market === "cl") {
      await this.expectQaAddress(updatedAddress.street);
      return;
    }
    if (this.market !== "pe") await this.expectAddressNotification(/actualiz|editad|guardad|success/i);
    await this.expectQaAddress(updatedAddress.street);
  }

  async deleteQaAddress(marker) {
    let clicked = false;
    for (let attempt = 0; attempt < (this.market === "cl" ? 3 : 1); attempt++) {
      const card = await this.qaCard(marker);
      try {
        const remove = card.getByRole("button", { name: /Eliminar|Delete|Remove/i });
        if (this.market === "cl") await remove.evaluate((button) => button.click());
        else await remove.click({ timeout: 5000 });
        clicked = true;
        break;
      } catch (error) {
        if (attempt === 2 || !/detached|intercepts pointer|Timeout/i.test(String(error))) throw error;
        await this.page.waitForTimeout(250);
      }
    }
    if (!clicked) throw new Error(`Could not open deletion for QA address ${marker}.`);
    if (this.market === "cl") {
      const dialog = this.page.getByRole("dialog").filter({ hasText: /eliminar/i }).last();
      await dialog.getByRole("button", { name: /Eliminar|S[ií]|Confirmar/i }).last().click();
      await expect(this.page.getByText(marker, { exact: false })).toHaveCount(0, { timeout: 30000 });
      return;
    }
    const confirm = this.page.getByRole("button", { name: /Confirmar|Eliminar|Sí|Delete|Remove/i }).last();
    if (await confirm.isVisible()) await confirm.click();
    if (this.market !== "pe") await this.expectAddressNotification(/elimin|remov|success/i);
    await expect(this.page.getByText(marker, { exact: false })).toHaveCount(0);
  }

  async setQaAddressDefault(marker) {
    const card = await this.qaCard(marker);
    await card.getByRole("button", { name: /Predeterminad|Principal|Default/i }).click();
    await this.expectAddressNotification(/predetermin|principal|default|actualiz|success/i);
    await expect(card).toContainText(/Predeterminad|Principal|Default/i);
  }

  async captureCurrentDefaultAddress() {
    const card = this.addressCards.filter({ hasText: /Predeterminad|Principal|Default/i }).first();
    if (!(await card.isVisible())) return null;
    return (await card.innerText()).replace(/\s+/g, " ").trim();
  }

  async restoreDefaultAddress(previousText) {
    if (!previousText) return;
    const signature = previousText.slice(0, 80);
    const card = this.addressCards.filter({ hasText: signature }).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    if (!/Predeterminad|Principal|Default/i.test(await card.innerText())) {
      await card.getByRole("button", { name: /Predeterminad|Principal|Default/i }).click();
      await this.expectAddressNotification(/predetermin|principal|default|actualiz|success/i);
    }
  }

  async expectQaAddress(marker) {
    if (this.market === "pe") await this.expandPeAddressesUntil(marker);
    if (this.market === "cl") await this.expandClAddressesUntil(marker);
    await expect(this.page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 30000 });
  }

  async qaCard(marker) {
    if (!marker.startsWith(this.qaMarker)) {
      throw new Error("Refusing to mutate a non-QA address.");
    }
    if (this.market === "pe") await this.expandPeAddressesUntil(marker);
    if (this.market === "cl") await this.expandClAddressesUntil(marker);
    const card = this.market === "cl"
      ? this.page.getByText(marker, { exact: false }).first()
        .locator('xpath=ancestor::*[.//button[@data-an-la="address:edit"]][1]')
      : this.addressCards.filter({ hasText: marker }).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    return card;
  }

  async expandPeAddressesUntil(marker) {
    const panel = this.page.getByRole("tabpanel", { name: "Envío" });
    await panel.getByRole("listitem").first().waitFor({ state: "visible", timeout: 30000 });
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await panel.getByRole("listitem").filter({ hasText: marker }).count()) return;
      const more = panel.getByRole("button", { name: "Ver más" });
      if (!(await more.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false))) return;
      const before = await panel.getByRole("listitem").count();
      await more.click();
      await expect.poll(() => panel.getByRole("listitem").count(), { timeout: 10000 }).toBeGreaterThan(before);
    }
  }

  async expandClAddressesUntil(marker) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await this.page.getByText(marker, { exact: false }).first().isVisible().catch(() => false)) return;
      const more = this.page.getByRole("button", { name: /Ver m[aá]s/i }).filter({ visible: true }).first();
      if (!(await more.isVisible().catch(() => false))) return;
      await more.click();
      await this.page.waitForTimeout(300);
    }
  }

  async expectAddressNotification(pattern) {
    await this.page.getByRole("alert").or(this.page.locator('[class*="toast" i]'))
      .filter({ hasText: pattern }).first()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async fillAddressForm(address) {
    if (this.market === "cl") {
      const dialog = this.page.getByRole("dialog").filter({ hasText: /direcci[oó]n/i }).last();
      await dialog.locator('input[formcontrolname="phone"]').fill(String(address.phone));
      await dialog.locator('input[formcontrolname="vatNumber"]').fill(String(address.rut));
      const choose = async (field, name) => {
        const control = dialog.locator(`mat-select[formcontrolname="${field}"]`);
        await expect(control).toBeEnabled({ timeout: 15000 });
        const options = this.page.getByRole("option").filter({ visible: true });
        for (let attempt = 0; attempt < 3; attempt++) {
          if ((await control.getAttribute("aria-expanded")) !== "true") await control.click();
          const offered = await options.first().waitFor({ state: "visible", timeout: 4000 })
            .then(() => true, () => false);
          if (!offered) continue;
          const preferred = options.filter({ hasText: new RegExp(name === "Alhué" ? "Alhu[eé]" : "Metropolitana", "i") }).first();
          await (await preferred.isVisible().catch(() => false) ? preferred : options.first()).click();
          return;
        }
        throw new Error(`CL ${field} did not offer options after 3 attempts; control=${(await control.evaluate((el) => el.outerHTML)).slice(0, 700)}`);
      };
      await choose("regionIso", address.region);
      await choose("townCity", address.commune);
      await dialog.locator('input[formcontrolname="line1"]').fill(String(address.number));
      const street = dialog.locator('input[formcontrolname="line2"]');
      await street.fill(address.street);
      await street.press("Tab");
      await expect(street).toHaveClass(/ng-valid/, { timeout: 10000 });
      return;
    }
    if (this.market === "pe") {
      const dialog = this.page.getByRole("dialog", { name: /Añadir nueva dirección|Editar Dirección/i }).first();
      await dialog.getByRole("textbox", { name: "Teléfono Móvil" }).fill(String(address.phone || "944895260"));
      const documentType = dialog.getByRole("combobox", { name: "Tipo de Documento" });
      if (!(await documentType.innerText()).includes("DNI")) {
        await documentType.click();
        await this.page.getByRole("option", { name: "DNI", exact: true }).click();
      }
      const documentNumber = dialog.getByRole("textbox", { name: "Número de documento de identidad" });
      await expect(documentNumber).toBeEnabled();
      await documentNumber.fill(String(address.documentNumber || "12345678"));
      for (const [label, value] of [
        ["Departamento", address.department],
        ["Provincia", address.province],
        ["Distrito", address.district],
      ]) {
        const control = dialog.getByRole("combobox", { name: label, exact: true });
        const option = this.page.getByRole("option", { name: value, exact: true });
        let offered = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if ((await control.getAttribute("aria-expanded")) !== "true") await control.click();
          offered = await option.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false);
          if (offered) break;
        }
        if (!offered) {
          const choices = await this.page.getByRole("option").allTextContents();
          const combobox = await control.evaluate((element) => element.outerHTML);
          throw new Error(`PE ${label} did not offer ${value}; options=${JSON.stringify(choices)}; control=${combobox.slice(0, 1200)}`);
        }
        await option.click();
      }
      await dialog.getByRole("textbox", { name: "Dirección", exact: true }).fill(address.street);
      await dialog.getByRole("textbox", { name: "Número", exact: true }).fill(String(address.number));
      await dialog.getByRole("checkbox", { name: "Nombre de la persona que va a recibir" }).check();
      await dialog.getByRole("textbox", { name: "Nombre", exact: true }).last().fill(await dialog.getByRole("textbox", { name: "Nombre", exact: true }).first().inputValue());
      await dialog.getByRole("textbox", { name: "Apellidos", exact: true }).last().fill(await dialog.getByRole("textbox", { name: "Apellidos", exact: true }).first().inputValue());
      await dialog.getByRole("textbox", { name: "Teléfono Móvil" }).last().fill(String(address.phone || "944895260"));
      await dialog.getByRole("combobox", { name: "Tipo de Documento" }).last().click();
      await this.page.getByRole("option", { name: "DNI", exact: true }).click();
      await dialog.getByRole("textbox", { name: "Número de documento de identidad" }).last().fill(String(address.documentNumber || "12345678"));
      return;
    }
    const form = this.page.locator("form").filter({ has: this.page.getByText(/dirección|address/i) }).last();
    await form.getByRole("textbox", { name: /line1|dirección|address/i }).first().fill(address.street);
    const line2 = form.getByRole("textbox", { name: /line2|número|referencia/i }).first();
    if (await line2.isVisible()) await line2.fill(String(address.number));
    for (const [label, value] of [
      [/Departamento/i, address.department],
      [/Provincia/i, address.province],
      [/Distrito/i, address.district],
    ]) {
      const select = form.getByRole("combobox", { name: label });
      if (await select.isVisible()) await select.selectOption({ label: value });
    }
  }

  async deleteQaAddressesViaApi(marker) {
    if (!marker.startsWith(this.qaMarker)) {
      throw new Error("Refusing API cleanup for a non-QA address.");
    }
    const endpoint = this.assertAddressApiUrl();
    const response = await this.requestAddressApi("GET", endpoint);
    if (!response.ok()) {
      throw new Error(`Address cleanup listing returned HTTP ${response.status()}.`);
    }
    const payload = await response.json();
    const addresses = payload.addresses || payload || [];
    const matches = addresses.filter((address) =>
      [address.line1, address.line2, address.formattedAddress, address.addressName]
        .filter(Boolean)
        .some((value) => String(value).includes(marker))
    );
    for (const address of matches) {
      if (!address.id) throw new Error("QA address has no deletable id.");
      const deletion = await this.requestAddressApi(
        "DELETE",
        `${endpoint}/${encodeURIComponent(address.id)}`
      );
      if (!deletion.ok()) {
        throw new Error(`QA address cleanup returned HTTP ${deletion.status()}.`);
      }
    }
    return matches.length;
  }
}
