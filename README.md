# Samsung Order Automation

Automação E2E do fluxo de compra Guest Checkout da Samsung utilizando Playwright.

## Objetivo

Validar o fluxo completo de compra como usuário convidado (Guest Checkout), desde a seleção do produto até a confirmação do pedido.

## Stack

- Playwright
- JavaScript
- Page Object Model (POM)
- Git / GitHub

## Estrutura do Projeto

- `pages/` - Page Objects
- `fixtures/` - Massa de dados
- `tests/` - Cenários E2E
- `utils/` - Utilitários
- `docs/` - Documentação
- `evidence/screenshots/` - Evidências

## Executar o Projeto

Instalar dependências:

npm install

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

npx playwright test 

Abrir relatório:

npx playwright show-report 

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