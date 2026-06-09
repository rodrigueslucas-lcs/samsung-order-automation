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

- pages/ - Page Objects
- fixtures/ - Massa de dados
- tests/ - Cenários E2E
- utils/ - Utilitários
- docs/ - Documentação
- evidence/screenshots/ - Evidências geradas durante a execução

## Instalação

npm install 

## Execução

Executar todos os testes:

npx playwright test 

Executar teste específico:

npx playwright test tests/guest-checkout.spec.js 

Abrir relatório:

npx playwright show-report 

## Resultado

Fluxo validado com sucesso.

Pedido criado:

PE260608-72096115

## Funcionalidades Implementadas

- Guest Checkout
- Adição de produto ao carrinho
- Validação de carrinho
- Preenchimento de dados do cliente
- Preenchimento de endereço
- Seleção de método de entrega
- Aceite de termos e condições
- Pagamento com cartão de crédito
- Criação de pedido
- Captura automática do número do pedido
- Screenshots automáticos
- Gravação de vídeo
- Trace Viewer
- HTML Report

## Evidências Geradas

A cada execução o framework gera automaticamente:

## Evidências

- HTML Report
- Screenshots automáticos
- Vídeos de execução
- Trace Viewer
- Captura do número do pedido

## Arquitetura

O projeto utiliza o padrão Page Object Model (POM), promovendo:

- Reutilização de código
- Facilidade de manutenção
- Separação de responsabilidades
- Escalabilidade para novos fluxos

## Status Atual

✅ Framework concluído

✅ Fluxo Guest Checkout implementado

✅ Integração GitHub concluída

✅ Evidências automáticas implementadas

✅ Captura de número do pedido implementada

✅ Fluxo E2E validado com criação real de pedido

## Autor

Lucas Rodrigues

QA Engineer.