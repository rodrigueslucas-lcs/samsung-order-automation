# CL S1 — Base Store P1

Validação local em 14/10/2026, Chrome headed e uma verificação CI em Node 22/headless, um worker e sem retries. Resultados consolidados de rodadas direcionadas; não representam uma campanha completa verde. Inventário e cobertura oficial preservados.

## Acesso e sessão

O acesso direto ao S1 reproduziu `SYSTEM CHECK`. Após abrir `/getcookie.html` na mesma origem, a home e o perfil renderizaram. O bootstrap agora atende tanto o refresh quanto os testes CL S1/S2. `CL_SETUP_URL` aceita somente HTTPS na origem do storefront.

O refresh CL S1 terminou READY na primeira tentativa após CAPTCHA humano: login, verificação positiva em contexto novo e pacote. Uma sessão expirou durante o trabalho e foi renovada pelo mesmo fluxo; arquivo existente não é prova de autenticação.

## PASS local confirmado

- Conta e perfil: SAM-24784, SAM-24785, SAM-24786.
- Carrinho e Rewards baseline: SAM-24790, SAM-24791, SAM-24793, SAM-24794.
- Desktop: SAM-24806.
- Checkout: SAM-24808, SAM-24810, SAM-24812, SAM-24813, SAM-24815, SAM-24816, SAM-24817, SAM-24819.
- Back to Top: SAM-24821.

Consolidado: 17 PASS, 5 FAIL brutos, 8 SKIP por dependências e 1 NOT_RUN (confirmação, sem submissão após recusa de frete). Não é resultado de uma execução única.

As correções tratam contato obrigatório antes de entrega, formulário novo direto quando não há endereço salvo, painel direto de Envío e seleção por teclado da comuna de faturamento fora da viewport. Todas as validações finais foram mantidas.

Uma fixture `QA AUTOMATION CL BASESTORE`, comuna Santiago, foi criada pela UI e confirmada por leitura de volta para selecionar/alternar endereço salvo. Ela foi mantida para reexecução local. O lifecycle elimina somente os registros criados pela própria execução, preservando dados preexistentes.

## Pendências concretas

| SAM | Resultado / dependência |
| --- | --- |
| 24807 | Login pelo checkout chegou a CAPTCHA humano; a etapa de senha não apareceu no prazo de 180 segundos. A execução terminou sem comprovar retorno autenticado; requer completar a verificação na próxima execução isolada. |
| 24811, 24814 | O checkout não chega a pagamento. Com o SKU `SM-S918BZKILTL`, tanto Alhué quanto a alternativa Santiago retornaram “Desafortunadamente, el despacho no esta disponible en tu región y comuna”. Região/comuna selecionadas e termos foram conferidos. Falta cobertura de entrega/SKU compatível no S1. |
| 24818 | Retiro en tienda não aparece para o produto atual. Falta SKU/configuração de retirada habilitada. |
| 24830 | Login BackOffice S1 não chegou à perspectiva autenticada/seleção de autoridade. Falta restabelecer esse acesso antes das pesquisas; não foi atribuído genericamente a senha sem prova. |
| 24831 | Requer `CL_QST_ORDER_CODE` de uma ordem S1 verificada em SHIPPING_REQUESTED, além do login BackOffice. A referência histórica do S2 não é reutilizada automaticamente em S1. |
| 24826 | Sem nova submissão/ordem: a dependência de despacho já foi recusada em duas comunas. Confirmação e número visível continuam obrigatórios; não houve PASS de confirmação. |
| 24797, 24803, 24804 | Skips oficiais existentes: faltam SKU/oferta elegíveis para BOGO, Trade-in e Care+. |
| 24822–24825 | Skips oficiais existentes de cartão registrado, transferência, parcelas e Rewards; requerem massa/fluxo aprovado e suas dependências próprias. |

`CL_QST_COMMUNE` permite selecionar explicitamente uma comuna oferecida na UI; o padrão histórico Alhué foi preservado. Testar Santiago não comprovou cobertura de entrega e não foi promovido a massa de pagamento válida.

## Reexecução

### SAM-24807 — revalidação em 2026-10-15

PASS local, sem skip: o login legítimo iniciado pelo checkout retornou a `CHECKOUT_STEP_CONTACT_INFO`. O teste agora reutiliza `completeClRegisteredContact` antes de exigir despacho; mantém a comprovação de logout disponível na home autenticada e o retorno ao checkout de despacho.

Comando executado em PowerShell:

```powershell
$env:CL_QST_ENVIRONMENT='S1'; $env:CL_AUTH_AUTO_RENEW='0'; $env:ALLOW_PAYMENT_SUBMIT='0'; $env:ENABLE_ALLURE='0'
npx playwright test tests/markets/cl/qst/base-store/official-p1.spec.js --project=chromium --workers=1 --retries=0 --grep SAM-24807 --headed --reporter=list --output=test-results/cl-s1-payment-followup/checkout-login-contact-fix
```

Resultado: `1 passed (4.1m)`, exit 0. CAPTCHA concluído pelo operador na janela maximizada. Nenhum pagamento enviado. Evidência local ignorada: diretório acima, incluindo `.last-run.json`. Este resultado substitui o bloqueio histórico do SAM-24807 descrito anteriormente; não comprova execução autônoma em Jenkins, pois o provedor solicitou verificação humana.

Os SAM-24822–24826 não foram promovidos a PASS por essa validação. A inspeção separada não chegou ao pagamento: o rádio de novo endereço ficou selecionado, mas o campo `line2` não apareceu. Isso não comprova rejeição de cartão nem confirmação de ordem. Nenhuma nova ordem foi enviada nessa investigação.

```bash
CL_QST_ENVIRONMENT=S1 npm run auth:refresh:cl
CL_QST_ENVIRONMENT=S1 npm run qst:cl:base-store:list
CL_QST_ENVIRONMENT=S1 npm run qst:cl:base-store
```

O runner preserva os guards. Submissão de pagamento exige `ALLOW_PAYMENT_SUBMIT=1`; quantidade um é obrigatória no fluxo de confirmação. Não habilitar/repetir pagamento para contornar a falta de despacho.

## Validação técnica

- 30 testes focados de configuração, cobertura, refresh e retorno CL: PASS.
- Arquitetura e inventário oficial: PASS.
- Steps/refactor: lacunas preexistentes de etapas explícitas CL continuam registradas, sem alterações apenas para tornar o gate verde.
- Runtime S2 não reexecutado; contrato de bootstrap S2 preservado e validado estaticamente.
- Evidência local ignorada: `test-results/cl-s1-stabilization/`.


## Jenkins — CL S1 Base Store

A lane aceita S1/S2 e seleciona explicitamente `CL_QST_STORE=BS`: 31 casos Base Store, sem misturar os sete EPP. O inventário geral de 38 casos CL permanece disponível nos runners de CLI. O job mantém o filtro `P1_TARGET_IDS` e verifica a sessão antes da execução.

Antes do build, renove e publique o bundle no Jenkins configurado pelo operador:

```bash
CL_QST_ENVIRONMENT=S1 npm run auth:refresh:cl
CL_QST_ENVIRONMENT=S1 npm run auth:publish:jenkins:cl
```

O publisher existente requer `JENKINS_URL`, `JENKINS_USER` e `JENKINS_API_TOKEN` no ambiente local. Nenhum valor deve ir para Git ou log. A publicação não foi executada nesta tarefa; o bundle é temporário e deve estar fresco na hora do build.

Credenciais de arquivo esperadas pelo job:

- `samsung-cl-s1-session-bundle`: bundle CL S1 publicado pelo fluxo acima.
- `samsung-mx-s2-backoffice-admin`: credencial compartilhada existente, também reutilizada pelo PE S1; o nome é legado. O arquivo instalado recebe o sufixo do ambiente selecionado. O acesso observado localmente precisa ser restabelecido.
- `samsung-mx-test-card`: massa de cartão já usada pelo projeto; não significa que o pagamento CL S1 esteja validado.

Parâmetros:

| Parâmetro | Valor |
| --- | --- |
| MARKET | CL |
| ENVIRONMENT | S1 |
| TEST_SUITE | official-p1 |
| EXECUTION_MODE | authorized-destructive |
| BROWSER_MODE | headless |
| EVIDENCE_MODE | screenshots-trace |
| AUTH_SOURCE | session-bundle |
| CL_ORDER_CODE | Opcional: ordem CL S1 verificada em SHIPPING_REQUESTED para o SAM-24831; deixe vazio enquanto não houver massa. |
| P1_TARGET_IDS | Vazio para os 31 casos, incluindo os bloqueios descritos; ou uma seleção explícita abaixo. |

`authorized-destructive` agora aciona os opt-ins CL de perfil/pagamento; a quantidade um e as asserções de confirmação permanecem. A execução completa ainda encontrará os bloqueios reais registrados, portanto não há garantia de build verde com os 31 casos.

Seleção reproduzível dos 17 casos com PASS local, sem alterar o escopo padrão da suíte:

```text
SAM-24784,SAM-24785,SAM-24786,SAM-24790,SAM-24791,SAM-24793,SAM-24794,SAM-24806,SAM-24808,SAM-24810,SAM-24812,SAM-24813,SAM-24815,SAM-24816,SAM-24817,SAM-24819,SAM-24821
```

Use essa lista em `P1_TARGET_IDS`, ou em `CL_QST_TARGET_IDS` localmente. Não inclui pagamento. Exige sessão válida e a fixture QA salva já preparada. O SAM-24807 exige nova autenticação no Samsung Account e pode pedir CAPTCHA; uma sessão de refresh READY não prova esse TC e não permite contornar a verificação humana em CI.

Validação CI realizada localmente: SAM-24784 PASS com `CI=1`, Node 22, headless e trace ligado, com integridade do ZIP conferida. Uma captura anterior em Node 24 falhou no fechamento do trace; o caso foi reexecutado sem erro no perfil CI. A causa definitiva dessa falha isolada de captura não foi atribuída ao Node sem prova. O build Jenkins e a existência/validade das credenciais remotas não foram verificados por execução remota.

Cinco testes novos do contrato da lane e cinco testes afetados de reporting passaram. Os fixes de layout dos KPIs foram preservados.
