# Samsung Detailed Smoke Automation

Playwright automation framework for Samsung SDS eCommerce Detailed Smoke Test scenarios.

The project is focused on progressively automating the **ST2 Detailed Smoke Test for Samsung Peru (PE)** while keeping the repository structure and test naming aligned with the official QA documentation maintained in Confluence.

## Objective

Build a maintainable automation framework capable of supporting the complete Detailed Smoke suite instead of creating isolated scripts for each scenario.

The framework started with a complete Guest Checkout E2E flow and is now being expanded into individual Detailed Smoke scenarios using reusable Page Objects and shared flows.

## Detailed Smoke Scope

The PE Detailed Smoke Test is currently divided into two main suites:

- **Base Store:** 83 scenarios
- **EPP Store:** 59 scenarios

Base Store and EPP have independent test-case numbering and are therefore organized separately in the repository.

The overall scope includes:

- Login
- My Account
- Product Detail Page (PDP)
- Cart
- Checkout
- Delivery
- Payment
- Order Confirmation
- Payment Modes
- BackOffice
- Order Fulfillment
- Mobile

## Stack

- Playwright
- Playwright Test
- JavaScript
- Node.js
- Page Object Model (POM)
- Chromium
- Git / GitHub

## Project Architecture

```text
samsung-order-automation/
├── pages/
│   ├── BasePage.js
│   ├── ProductPage.js
│   ├── CartPage.js
│   ├── GuestLoginPage.js
│   ├── CheckoutPage.js
│   ├── PaymentPage.js
│   └── OrderConfirmationPage.js
│
├── tests/
│   └── st2/
│       ├── base-store/
│       │   ├── cart/
│       │   ├── checkout/
│       │   ├── pdp/
│       │   └── smoke/
│       │
│       └── epp/
│           ├── login/
│           ├── my-account/
│           ├── cart/
│           ├── checkout/
│           ├── payment/
│           ├── backoffice/
│           └── fulfillment/
│
├── utils/
│   └── testData.js
│
├── evidence/
│   └── screenshots/
│
└── playwright.config.js
```

## Automation Design

The project uses **Page Object Model (POM)** to separate page interaction logic from test scenarios.

This provides:

- Reusable components
- Reduced code duplication
- Easier maintenance
- Better scalability
- Easier debugging
- Reuse between Base Store and EPP
- Better preparation for CI/CD execution

Page Objects remain shared under `pages/`. Store-specific behavior should only be separated when the implementation actually differs.

## Test Organization

Detailed Smoke scenarios keep the same test-case identification used in the official QA documentation.

Example:

```javascript
test(
  "TC17 - Customer able to increase and decrease the quantity (or remove products)",
  async ({ page }) => {
    // test implementation
  }
);
```

The suite name also identifies the store explicitly:

```javascript
test.describe("ST2 - Base Store - Cart Page", () => {});
```

Future EPP scenarios follow the same convention:

```javascript
test.describe("ST2 - EPP - Cart Page", () => {});
```

This avoids ambiguity because Base Store and EPP use different TC numbering.

## Current Automated Coverage

### Base Store

Current individual Detailed Smoke coverage includes:

#### Cart

- Cart page availability
- Product validation in Cart
- Product quantity increase/decrease
- Order summary validation
- Checkout button visibility
- Navigation from Cart to Checkout

#### Checkout

- Checkout Login Page
- Checkout Address Page
- Login / Rewards option displayed during Checkout

#### PDP

- PDP navigation and page validation
- Product attributes
- Selected product color variant

### End-to-End Guest Checkout

A complete Guest Checkout flow is also implemented and currently covers:

1. Product setup
2. Add to Cart
3. Cart validation
4. Guest Checkout
5. Customer information
6. Delivery address
7. Delivery mode
8. Terms and conditions
9. Payment page
10. Credit card data
11. Order placement
12. Order confirmation

The E2E flow is reused as the foundation for additional Detailed Smoke scenarios instead of duplicating the same navigation and interaction logic.

## Test Data

Reusable test data is centralized in:

```text
utils/testData.js
```

Environment-specific and reusable data should remain centralized instead of being duplicated across specs.

## Installation

```bash
npm install
npx playwright install
```

## Execution

Run the complete suite:

```bash
npx playwright test
```

Run with browser visible:

```bash
npx playwright test --headed
```

List all available tests:

```bash
npx playwright test --list
```

Run all Base Store tests:

```bash
npx playwright test tests/st2/base-store
```

Run Cart Detailed Smoke tests:

```bash
npx playwright test tests/st2/base-store/cart/cart.spec.js
```

Run Checkout Detailed Smoke tests:

```bash
npx playwright test tests/st2/base-store/checkout/checkout.spec.js
```

Run one specific TC:

```bash
npx playwright test -g "TC36"
```

Open the Playwright HTML report:

```bash
npx playwright show-report
```

## Evidence and Debugging

The framework supports:

- Playwright HTML Report
- Automatic screenshots
- Video recording
- Trace Viewer
- Failure screenshots
- Order confirmation evidence
- Captured order number for completed E2E journeys

Trace example:

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

## Environment

Current automation development is focused on:

```text
ST2 - Peru (PE)
```

The architecture is being prepared to expand coverage without duplicating the core framework.

## Roadmap

1. Expand Base Store Detailed Smoke coverage
2. Reuse existing Page Objects and E2E flows
3. Complete Checkout coverage
4. Expand Payment coverage
5. Add Login and Registered User scenarios
6. Add EPP Detailed Smoke coverage
7. Add BackOffice automation
8. Add Order Fulfillment automation
9. Expand Payment Mode coverage
10. Add Mobile execution
11. Prepare stable CI/CD execution

## Project Status

| Area | Status |
|---|---|
| Playwright framework | Implemented |
| Page Object Model | Implemented |
| Guest Checkout E2E | Implemented |
| Credit Card order journey | Implemented |
| Base Store Detailed Smoke | In Progress |
| EPP Detailed Smoke | Planned |
| BackOffice automation | Planned |
| Order Fulfillment automation | Planned |
| Mobile coverage | Planned |
| CI/CD execution | Planned |

## Author

**Lucas Rodrigues**  
QA Engineer

## Automation Coverage

The current ST2 Peru Detailed Smoke automation status is tracked in:

[Coverage Matrix](docs/COVERAGE_MATRIX.md)
