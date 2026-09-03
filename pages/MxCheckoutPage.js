import BasePage from "./BasePage";

export default class MxCheckoutPage extends BasePage {
  constructor(page) {
    super(page);
    this.contactContinue = page.getByRole("button", {
      name: /Continuar al m[eé]todo de entrega/i,
    });
  }

  async startGuest(email) {
    await this.page.getByPlaceholder(/ingresa tu correo/i).fill(email);
    const guest = this.page.getByRole("button", {
      name: /Continuar como (usuario )?invitado/i,
    });
    await guest.click();
    await this.page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, { timeout: 60000 });
  }

  async fillContact({ firstName, lastName, phone }) {
    await this.page.getByRole("textbox", { name: "firstName" }).fill(firstName);
    await this.page.getByRole("textbox", { name: "lastName" }).fill(lastName);
    await this.page.getByRole("textbox", { name: "phone", exact: true }).fill(phone);
    if ((await this.page.getByRole("textbox", { name: "phone", exact: true }).inputValue()) !== phone) {
      throw new Error("MX guest phone was not retained.");
    }

    const checkboxes = this.page.locator('input[type="checkbox"]:visible');
    for (let index = 0; index < await checkboxes.count(); index += 1) {
      const checkbox = checkboxes.nth(index);
      if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
    }

    await this.contactContinue.waitFor({ state: "visible", timeout: 30000 });
    if (!(await this.contactContinue.isEnabled())) {
      throw new Error("MX Contact continue remained disabled after valid QA data.");
    }
    await this.contactContinue.click();
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 60000 });
  }

  async fillRegisteredContact({ firstName, lastName, phone }) {
    const deliveryRegion = this.page.getByRole("region", {
      name: /2\. M[eé]todo de Entrega/i,
    });
    const firstNameInput = this.page
      .getByRole("textbox", { name: "firstName", exact: true })
      .filter({ visible: true });
    const deliveryOpened = await deliveryRegion
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (deliveryOpened) return;

    await firstNameInput.waitFor({ state: "visible", timeout: 30000 });

    const lastNameInput = this.page
      .getByRole("textbox", { name: "lastName", exact: true })
      .filter({ visible: true });
    const phoneInput = this.page
      .getByRole("textbox", { name: "phone", exact: true })
      .filter({ visible: true });
    await firstNameInput.fill(firstName);
    await lastNameInput.fill(lastName);
    await phoneInput.fill(phone);

    for (const name of [/T[eé]rminos y condiciones/i, /Aviso de Privacidad/i]) {
      const checkbox = this.page.getByRole("checkbox", { name }).first();
      await checkbox.waitFor({ state: "visible", timeout: 30000 });
      if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
    }

    const optionalAccountChoices = this.page.getByRole("checkbox", {
      name: /ofertas y promociones|Samsung Rewards/i,
    });
    for (let index = 0; index < await optionalAccountChoices.count(); index += 1) {
      const checkbox = optionalAccountChoices.nth(index);
      if (await checkbox.isChecked()) await checkbox.uncheck({ force: true });
    }

    await this.contactContinue.waitFor({ state: "visible", timeout: 30000 });
    if (!(await this.contactContinue.isEnabled())) {
      throw new Error("MX registered Contact continue remained disabled after required QA data.");
    }
    await this.contactContinue.click();
    await this.page.waitForURL(/CHECKOUT_STEP_DELIVERY/, { timeout: 60000 });
  }

  async fillDelivery({ postalCode, street, exteriorNumber }, { registered = false } = {}) {
    const postal = this.page.getByRole("textbox", { name: /postal|c[oó]digo postal/i });
    await postal.waitFor({ state: "visible", timeout: 60000 });
    const addressResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("getAddressForWardPostCode") &&
        response.url().includes(`postCode=${postalCode}`),
      { timeout: 60000 }
    );
    await postal.fill(postalCode);
    await postal.press("Tab");
    const response = await addressResponse;
    if (response.status() !== 200) {
      throw new Error(`MX postal-code lookup returned HTTP ${response.status()}.`);
    }

    const colonia = this.page.getByRole("combobox", { name: /Colonia/i });
    await colonia.waitFor({ state: "visible", timeout: 30000 });
    await colonia.click();
    const options = this.page.getByRole("option").filter({ visible: true });
    await options.first().waitFor({ state: "visible", timeout: 30000 });
    const selectedColonia = (await options.first().innerText()).trim();
    await options.first().click();

    await this.page.waitForFunction(() => {
      const district = document.querySelector('input[name="district"], input[aria-label="district"]');
      const region = document.querySelector('input[name="regionIso"], input[aria-label="regionIso"]');
      return Boolean(district?.value && region?.value);
    }, null, { timeout: 30000 });

    await this.page.getByRole("textbox", { name: "line2" }).fill(street);
    await this.page.getByRole("textbox", { name: "line1" }).fill(exteriorNumber);

    const noInvoice = this.page.getByRole("radio", { name: "No", exact: true });
    await noInvoice.check({ force: true });

    const result = {
      lookupStatus: response.status(),
      selectedColonia,
      district: await this.readField("district"),
      region: await this.readField("regionIso"),
    };
    if ((await postal.inputValue()) !== postalCode) throw new Error("MX postal code was not retained.");
    if ((await this.page.getByRole("textbox", { name: "line2" }).inputValue()) !== street) {
      throw new Error("MX street was not retained.");
    }
    if ((await this.page.getByRole("textbox", { name: "line1" }).inputValue()) !== exteriorNumber) {
      throw new Error("MX exterior number was not retained.");
    }
    if (!result.district || !result.region) {
      throw new Error("MX postal lookup did not populate district and region.");
    }
    const visibleSaveAddress = this.page
      .getByRole("checkbox", { name: /Guardar.*(direcci[oó]n|env[ií]o)/i })
      .filter({ visible: true });
    if (await visibleSaveAddress.count()) {
      if (!registered) {
        throw new Error("Guest checkout unexpectedly exposed address persistence.");
      }
      for (let index = 0; index < await visibleSaveAddress.count(); index += 1) {
        const checkbox = visibleSaveAddress.nth(index);
        if (await checkbox.isChecked()) await checkbox.uncheck({ force: true });
      }
    }
    return result;
  }

  async readField(name) {
    const field = this.page.getByRole("textbox", { name }).first();
    if (!(await field.isVisible().catch(() => false))) return null;
    return field.inputValue();
  }

  async validateCheckoutSummary(sku) {
    await this.page.getByText(sku, { exact: true }).first().waitFor({
      state: "attached",
      timeout: 30000,
    });
    await this.page.getByRole("heading", { level: 3 }).filter({ visible: true }).first().waitFor({
      state: "visible",
      timeout: 30000,
    });
    await this.page.getByText(/Subtotal/i).first().waitFor({ state: "visible" });
    await this.page.getByText(/Total/i).first().waitFor({ state: "visible" });
  }

  async selectDeliveryAndContinue() {
    const standardDeliveryCards = this.page
      .locator("label")
      .filter({ hasText: /Entrega Est[aá]ndar/i })
      .filter({ visible: true });
    const deliveryEta = this.page
      .getByText(/Recibir[aá]s tu producto|Enviaremos tu producto/i)
      .filter({ visible: true })
      .first();

    await standardDeliveryCards.first().waitFor({ state: "visible", timeout: 60000 });
    await deliveryEta.waitFor({ state: "visible", timeout: 60000 });

    const visibleCardCount = await standardDeliveryCards.count();
    if (visibleCardCount !== 1) {
      throw new Error(
        `MX Delivery expected exactly one visible Standard delivery card; found ${visibleCardCount}.`
      );
    }

    const standardDeliveryCard = standardDeliveryCards.first();
    await standardDeliveryCard.click();
    const selected = await this.page
      .waitForFunction(
        (card) => Boolean(card.control?.checked || card.querySelector('input[type="radio"]')?.checked),
        await standardDeliveryCard.elementHandle(),
        { timeout: 30000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!selected) {
      throw new Error("MX Standard delivery card did not become selected.");
    }

    const resolveContinueButton = async () => {
      const buttons = this.page
        .getByRole("button", { name: /^Continuar$/i })
        .filter({ visible: true });
      await buttons.first().waitFor({ state: "visible", timeout: 30000 });
      const count = await buttons.count();
      if (count !== 1) {
        throw new Error(`MX Delivery expected exactly one visible Continue button; found ${count}.`);
      }

      const button = buttons.first();
      await button.scrollIntoViewIfNeeded();
      await button.waitFor({ state: "visible", timeout: 30000 });
      if (!(await button.isEnabled())) {
        throw new Error("MX Delivery continue remained disabled.");
      }
      await button.click({ trial: true });

      return this.page
        .getByRole("button", { name: /^Continuar$/i })
        .filter({ visible: true })
        .first();
    };

    const observeTransition = async (timeout) => this.page
      .waitForFunction(
        () => {
          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return (
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              style.opacity !== "0" &&
              bounds.width > 0 &&
              bounds.height > 0
            );
          };
          const visibleElements = Array.from(document.querySelectorAll("body *")).filter(isVisible);

          if (
            visibleElements.some((element) =>
              /^Por favor, selecciona una opci[oó]n de entrega\.?$/i.test(
                element.textContent?.trim() || ""
              )
            )
          ) {
            return "DELIVERY_SELECTION_ERROR";
          }

          if (window.location.href.includes("CHECKOUT_STEP_PAYMENT")) {
            return "PAYMENT";
          }

          const paymentRegions = Array.from(
            document.querySelectorAll('[role="region"], [role="tabpanel"]')
          );
          const visiblePaymentRegion = paymentRegions.find((region) => {
            if (!isVisible(region) || region.getAttribute("aria-hidden") === "true") return false;

            const labelledBy = region.getAttribute("aria-labelledby");
            const label = [
              region.getAttribute("aria-label") || "",
              labelledBy ? document.getElementById(labelledBy)?.textContent || "" : "",
              region.querySelector("h1, h2, h3, h4, h5, h6")?.textContent || "",
            ].join(" ");
            if (!/3\.\s*M[eé]todos de Pago/i.test(label)) return false;

            return Array.from(
              region.querySelectorAll('button, input, iframe, [role="button"], [role="tab"]')
            ).some(isVisible);
          });
          if (visiblePaymentRegion) return "PAYMENT";

          return null;
        },
        null,
        { timeout }
      )
      .then((result) => result.jsonValue())
      .catch((error) => {
        if (error?.name === "TimeoutError") return "NO_TRANSITION";
        throw error;
      });

    const firstContinue = await resolveContinueButton();
    await firstContinue.click();
    const firstTransition = await observeTransition(15000);

    if (firstTransition === "PAYMENT") return;
    if (firstTransition === "DELIVERY_SELECTION_ERROR") {
      throw new Error("MX Standard delivery was rejected after Continue.");
    }

    if (!this.page.url().includes("CHECKOUT_STEP_DELIVERY")) {
      throw new Error(`MX Delivery Continue reached an unexpected URL: ${this.page.url()}`);
    }

    const stillSelected = await standardDeliveryCards.first().evaluate(
      (card) => Boolean(card.control?.checked || card.querySelector('input[type="radio"]')?.checked)
    );
    if (!stillSelected) {
      throw new Error("MX Standard delivery became unselected after the first Continue attempt.");
    }

    const selectionAlert = this.page
      .getByText(/^Por favor, selecciona una opci[oó]n de entrega\.?$/i)
      .filter({ visible: true });
    if (await selectionAlert.count()) {
      throw new Error("MX Standard delivery was rejected after Continue.");
    }

    const secondContinue = await resolveContinueButton();
    await secondContinue.click();
    const secondTransition = await observeTransition(90000);

    if (secondTransition === "DELIVERY_SELECTION_ERROR") {
      throw new Error("MX Standard delivery was rejected after Continue.");
    }
    if (secondTransition !== "PAYMENT") {
      if (this.page.url().includes("CHECKOUT_STEP_DELIVERY")) {
        throw new Error(
          "MX Delivery Continue remained on Delivery after re-scroll and second controlled click."
        );
      }
      throw new Error(`MX Delivery Continue reached an unexpected URL: ${this.page.url()}`);
    }
  }

  async inspectPayment() {
    const paymentRegion = this.page.getByRole("region", { name: /3\. M[eé]todos de Pago/i });
    const buttons = paymentRegion.getByRole("button");
    await buttons.first().waitFor({ state: "visible", timeout: 60000 });
    return buttons.evaluateAll((items) =>
      items
        .filter((item) => item.offsetParent !== null)
        .map((item) => ({
          label: item.textContent?.replace(/\s+/g, " ").trim(),
          attributes: Object.fromEntries(
            [...item.attributes]
              .filter((attribute) => /^(id|name|value|data-|aria-)/i.test(attribute.name))
              .map((attribute) => [attribute.name, attribute.value])
          ),
        }))
        .filter((item) => item.label)
    );
  }

  async selectPaymentMode(name) {
    const button = this.page.getByRole("button", { name }).first();
    await button.waitFor({ state: "visible", timeout: 30000 });
    await button.click();
    if ((await button.getAttribute("aria-expanded")) !== "true") {
      throw new Error(`MX payment mode ${name} did not expand.`);
    }
    const panelId = await button.getAttribute("aria-controls");
    if (!panelId) throw new Error(`MX payment mode ${name} has no controlled panel.`);
    const panel = this.page.locator(`[id="${panelId}"]`);
    await panel.waitFor({ state: "visible", timeout: 30000 });
    return {
      panel,
      actions: await this.page.getByRole("button").evaluateAll((buttons) =>
        buttons
          .filter((item) => item.offsetParent !== null)
          .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
          .filter((label) => /Continuar|Pagar|Realizar/i.test(label || ""))
      ),
    };
  }

  async validatePaymentPage({ postalCode }) {
    await this.page.getByRole("region", { name: /3\. M[eé]todos de Pago/i }).waitFor({
      state: "visible",
      timeout: 60000,
    });
    const summary = this.page.getByRole("heading", { name: /Resumen de tu pedido/i });
    await summary.waitFor({ state: "visible", timeout: 30000 });
    const summaryText = await summary.locator("..").innerText();
    for (const label of ["Subtotal", "IVA"]) {
      if (!summaryText.includes(label)) throw new Error(`MX Payment summary omitted ${label}.`);
    }
    await this.page.getByRole("heading", { name: /Total con IVA/i }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    await this.page.getByRole("tab", { name: new RegExp(postalCode) }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    await this.page.getByRole("contentinfo").waitFor({ state: "visible", timeout: 30000 });
  }
}
