import { expect } from "@playwright/test";
import MyAccountPage from "./MyAccountPage";

export default class ProfilePage extends MyAccountPage {
  constructor(page) {
    super(page);
    this.profileButton = page.getByRole("button", { name: "My Profile", exact: true });
    this.qaMarker = "QA AUTOMATION";
    this.addressCards = page.locator(
      'article, [class*="address-card" i], [class*="address-item" i], [data-testid*="address" i]'
    );
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
    await this.openProfile();
    const entry = this.page.getByRole("link", { name: /Mis direcciones|Direcciones|Address/i })
      .or(this.page.getByRole("button", { name: /Mis direcciones|Direcciones|Address/i }))
      .first();
    await entry.waitFor({ state: "visible", timeout: 30000 });
    await entry.click();
    await this.page.getByText(/Direcciones|Address/i).first()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async listSavedAddresses() {
    await this.openAddressManagement();
    return this.addressCards.allInnerTexts();
  }

  async inspectSavedAddressesApi() {
    const endpoint =
      "https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/addresses";
    const response = await this.page.request.get(endpoint);
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
    const endpoint =
      "https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/addresses";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const response = await this.page.request.get(endpoint);
      if (!response.ok()) {
        throw new Error(`Address readback returned HTTP ${response.status()}.`);
      }
      const payload = await response.json();
      const addresses = Array.isArray(payload) ? payload : payload.addresses || [];
      const found = addresses.some((address) =>
        [address.line1, address.formattedAddress, address.addressName]
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
    await this.page.getByRole("button", { name: /Agregar|Añadir|Nueva dirección|Add address/i }).click();
    await this.fillAddressForm(address);
    await this.page.getByRole("button", { name: /Guardar|Save/i }).click();
    await this.expectAddressNotification(/agreg|cread|guardad|success/i);
    await this.expectQaAddress(address.street);
  }

  async editQaAddress(currentMarker, updatedAddress) {
    const card = await this.qaCard(currentMarker);
    await card.getByRole("button", { name: /Editar|Edit/i }).click();
    await this.fillAddressForm(updatedAddress);
    await this.page.getByRole("button", { name: /Guardar|Actualizar|Save|Update/i }).click();
    await this.expectAddressNotification(/actualiz|editad|guardad|success/i);
    await this.expectQaAddress(updatedAddress.street);
  }

  async deleteQaAddress(marker) {
    const card = await this.qaCard(marker);
    await card.getByRole("button", { name: /Eliminar|Delete/i }).click();
    const confirm = this.page.getByRole("button", { name: /Confirmar|Eliminar|Sí|Delete/i }).last();
    if (await confirm.isVisible()) await confirm.click();
    await this.expectAddressNotification(/elimin|remov|success/i);
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
    await expect(this.page.getByText(marker, { exact: false }).first()).toBeVisible();
  }

  async qaCard(marker) {
    if (!marker.startsWith(this.qaMarker)) {
      throw new Error("Refusing to mutate a non-QA address.");
    }
    const card = this.addressCards.filter({ hasText: marker }).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    return card;
  }

  async expectAddressNotification(pattern) {
    await this.page.getByRole("alert").or(this.page.locator('[class*="toast" i]'))
      .filter({ hasText: pattern }).first()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async fillAddressForm(address) {
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
    const endpoint =
      "https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/addresses";
    const response = await this.page.request.get(endpoint);
    if (!response.ok()) {
      throw new Error(`Address cleanup listing returned HTTP ${response.status()}.`);
    }
    const payload = await response.json();
    const addresses = payload.addresses || payload || [];
    const matches = addresses.filter((address) =>
      [address.line1, address.formattedAddress, address.addressName]
        .filter(Boolean)
        .some((value) => String(value).includes(marker))
    );
    for (const address of matches) {
      if (!address.id) throw new Error("QA address has no deletable id.");
      const deletion = await this.page.request.delete(`${endpoint}/${encodeURIComponent(address.id)}`);
      if (!deletion.ok()) {
        throw new Error(`QA address cleanup returned HTTP ${deletion.status()}.`);
      }
    }
    return matches.length;
  }
}
