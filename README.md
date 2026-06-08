# Samsung Order Automation

Automação E2E do fluxo de compra Guest Checkout da Samsung utilizando Playwright.

## Objetivo

Validar o fluxo completo de compra como usuário convidado (Guest Checkout), desde a seleção do produto até a confirmação do pedido.

## Stack

- Playwright
- JavaScript
- Page Object Model (POM)
- Git / GitHub

### Estrutura do Projeto

samsung-order-automation
├── docs
├── evidence
│   └── screenshots
├── fixtures
│   ├── customer.json
│   ├── address.json
│   └── card.json
├── pages
│   ├── BasePage.js
│   ├── ProductPage.js
│   ├── CartPage.js
│   ├── GuestLoginPage.js
│   ├── CheckoutPage.js
│   ├── PaymentPage.js
│   └── OrderConfirmationPage.js
├── tests
│   └── guest-checkout.spec.js
├── utils
│   └── testData.js
├── playwright.config.js
└── README.md

## Funcionalidades

- Fluxo Guest Checkout
- Page Objects reutilizáveis
- Massa de dados desacoplada
- Screenshots automáticos
- HTML Report nativo
- Trace Viewer
- Evidências de execução

## Executar o Projeto

Instalar dependências:

bash npm install 

Executar testes:

bash npx playwright test 

Abrir relatório:

bash npx playwright show-report 

## Evidências

O projeto gera automaticamente:

- Screenshots
- HTML Report
- Trace Viewer
- Vídeos de execução

## Status Atual

- Estrutura do framework concluída
- Fluxo Guest Checkout implementado
- Integração GitHub concluída
- Ajustes de seletores em andamento devido a deploy/manutenção do ambiente Samsung

## Autor

Lucas Rodrigues
QA Engineer