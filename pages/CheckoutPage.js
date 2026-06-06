import BasePage from './BasePage';

export default class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);

    this.customerContinueButton = page.getByRole('button', { name: /^continuar$/i });
    this.paymentContinueButton = page.getByRole('button', { name: /continuar con los métodos de pago/i });
  }

  async fillCustomerData(customer) {
    await this.page.waitForURL(/CHECKOUT_STEP_CONTACT_INFO/, { timeout: 30000 });

const inputs = this.page.locator('input');

await inputs.nth(0).waitFor({ state: 'visible', timeout: 30000 });
await inputs.nth(0).fill(customer.firstName);
    await this.page.locator('input').nth(1).fill(customer.lastName);
    await this.page.locator('input').nth(3).fill(customer.phone);

    await this.page.getByText(/por favor seleccione/i).click();
    await this.page.getByText(customer.documentType, { exact: true }).click();

    await this.page.locator('input').nth(4).fill(customer.documentNumber);

    await this.screenshot('04-customer-info');

    await this.customerContinueButton.click();
    await this.waitForPageLoad();

    await this.screenshot('05-delivery-step');
  }

  async fillAddress(address) {
    await this.page.getByText(/dirección de entrega/i).waitFor({ state: 'visible' });

    await this.page.getByText(/departamento/i).click();
    await this.page.getByText(address.department, { exact: true }).click();

    await this.page.getByText(/provincia/i).click();
    await this.page.getByText(address.province, { exact: true }).click();

    await this.page.getByText(/distrito/i).click();
    await this.page.getByText(address.district, { exact: true }).click();

    await this.page.locator('input').nth(0).fill(address.street);
    await this.page.locator('input').nth(1).fill(address.number);

    await this.screenshot('06-delivery-address');
  }

  async selectShippingMethod() {
    await this.page.getByText(/envío regular/i).click();
    await this.screenshot('07-shipping-method');
  }

  async acceptTerms() {
    await this.page.getByText(/autorizo el tratamiento/i).click();
    await this.page.getByText(/declaro que he leído/i).click();

    await this.screenshot('08-terms-accepted');
  }

  async continueToPayment() {
    await this.paymentContinueButton.click();
    await this.waitForPageLoad();

    await this.screenshot('09-payment-step');
  }
}