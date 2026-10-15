# CO S1 — Base Store P1

Validação local em 14/10/2026, Chrome headed, um worker e sem retries.

Última campanha completa: **20 PASS, 5 FAIL brutos e 4 SKIP**, com os 29 SAMs representados e **zero NOT_RUN**. O dashboard separa um dos cinco FAIL como **KNOWN DEFECT**, vinculado ao RT-746043: visualmente são 20 PASS, 4 FAIL, 4 BLOCKED e 1 KNOWN DEFECT. O inventário e a cobertura oficial não foram alterados.

O refresh primary terminou em READY após CAPTCHA humano, com logout confirmado em contexto novo. Os dois casos do gate de autenticação passaram e o runner executou os demais 27 casos. O BackOffice SAM-24920 passou usando a credencial compartilhada S1, sem alteração de ordem.

Depois da campanha, **SAM-24912 passou isolado**, com quantidade 1, zero retries e confirmação Samsung visível da ordem **CO261014-64013543**. Foi usada a Mastercard sandbox específica de CO, extraída da documentação oficial do Mercado Pago; a massa MX usada antes recebia rejeição 601. Considerando o último resultado de cada SAM: **21 PASS, 3 FAIL, 4 SKIP e 1 KNOWN DEFECT**. O relatório da campanha anterior continua preservado com seus resultados originais.

## Casos verdes

| Área | SAMs com PASS local |
| --- | --- |
| Login e conta | 24873, 24874 |
| Desktop, GNB e PLP | 24806, 24875, 24879 |
| Carrinho | 24882, 24883, 24886 |
| Checkout e endereços | 24898, 24899, 24900, 24901, 24902, 24903, 24904, 24905, 24909, 24910 |
| BackOffice | 24920 |
| Mobile | 24925 |

O SKU `RF32CG5910B1CO` está utilizável no S1. Os casos de salvar/editar criaram endereços QA no sandbox primary; esses registros foram mantidos intencionalmente como massa para a reexecução de selecionar endereço salvo e alternar modos. Os endereços preexistentes não foram descartados.

## Pendências concretas

| SAM | Resultado bruto | Evidência / pré-requisito necessário |
| --- | --- | --- |
| 24880 — BC | FAIL | A navegação aponta para `www.samsung.com`, fora do staging. Falta uma categoria BC válida no S1 via `CO_QST_BC_URL`, na mesma origem do storefront. O teste interrompe antes de adicionar produto por esse caminho público. |
| 24892 — SC+ | SKIP | O caso oficial continua bloqueado. Geladeira `RF32CG5910B1CO` e S24 Ultra `SM-S928BZTKLTC` entram no carrinho S1, mas não oferecem Care+. Falta SKU elegível e fluxo BC/PDP de staging para validar a adição. |
| 24893 — Trade-up | FAIL | Nenhum dos dois SKUs conhecidos mostrou Trade-up/Plan Canje/Renueva no carrinho S1. Falta uma oferta/SKU elegível habilitada nesse ambiente. |
| 24896 — Logout | FAIL | A sessão second existe, mas o menu confirmou estado deslogado. Requer refresh legítimo da segunda conta, export e verificação em contexto novo; renovar primary não renova second. |
| 24911 — Back to Top | FAIL bruto / KNOWN DEFECT no dashboard | Controle ausente após scroll e rodapé carregado. Bug [RT-746043](https://jira.secext.samsung.net/browse/RT-746043), já mapeado para PE/CO S1/S2. Requer correção da UI; o resultado bruto permanece intacto. |
| 24912 — Cartão registrado | PASS direcionado | Ordem CO261014-64013543 confirmada na Samsung usando a Mastercard sandbox regional CO. A rejeição 601 anterior ocorreu com a massa MX. O seletor final lê a massa CO S1; S2 preserva sua seleção anterior. |
| 24914 — ADDI | SKIP | Bloqueio oficial existente: depende de fluxo/callback sandbox aprovado e operações PSE/BO/Kibana. |
| 24915 — Rewards | SKIP | Bloqueio da implementação oficial atual. Requer massa e fluxo de resgate/pagamento com pontos aprovados; texto de Rewards no carrinho não prova pagamento. |
| 24919 — Tracking | SKIP | Falta pedido guest confirmado CO S1 com mailbox Mailinator correspondente. O novo modo de fixture permite validar tracking sem repetir o pagamento que falhou. OTP, identidade da ordem, status e resumo continuam obrigatórios. |

## Reexecução local

```bash
CO_QST_ENVIRONMENT=S1 CO_AUTH_SLOT=primary npm run auth:refresh:co
CO_QST_ENVIRONMENT=S1 CO_AUTH_SLOT=second npm run auth:refresh:co
CO_QST_ENVIRONMENT=S1 npm run qst:co:base-store
```

O runner oficial habilita escrita de perfil e submissão de pagamento por padrão. Para uma rodada sem essas ações:

```bash
CO_QST_ENVIRONMENT=S1 ALLOW_PAYMENT_SUBMIT=0 ALLOW_PROFILE_WRITE=0 npm run qst:co:base-store
```

Os SAMs de pagamento exigem `ALLOW_PAYMENT_SUBMIT=1`, e os de salvar/editar exigem `ALLOW_PROFILE_WRITE=1`. A rodada sem opt-in não valida esses casos; pode filtrá-los com `CO_QST_TARGET_IDS`.

`MX_AUTH_SLOT=second` agora é aceito pelo refresh CO como alias explícito, mas prefira `CO_AUTH_SLOT=second`. Seletores de conta conflitantes são rejeitados antes do login. O perfil second usa login humano e não repete automaticamente uma tentativa manual incompleta.

Para Tracking S1, use uma fixture local ignorada `playwright/.auth/co-s1-guest-tracking.json` com os campos `market: "CO"`, `environment: "S1"`, `confirmed: true`, `sku`, `orderNumber`, `email` e `inbox`. SKU e mailbox precisam corresponder à ordem real; dados de S2 ou de outro mercado são rejeitados. Não inclua tokens, cookies ou OTP nessa fixture.

Uma nova ordem para Tracking S1 só é criada com `CO_QST_TRACKING_CREATE_ORDER=1` e `ALLOW_PAYMENT_SUBMIT=1`, após os pré-requisitos de pagamento estarem válidos. A confirmação visível é obrigatória antes de preservar a referência. O comportamento padrão de criação de ordem do S2 foi mantido.

### Cartão sandbox regional

A referência oficial é [Mercado Pago CO — cartões de teste](https://www.mercadopago.com.co/developers/es/docs/your-integrations/test/cards). O arquivo local ignorado `playwright/.auth/co-s1-test-card.json` contém os campos `number`, `holderName`, `expiry`, `cvv` e `document`; os valores não são versionados. Também são aceitos `CO_TEST_CARD_FILE` ou as variáveis `CO_TEST_CARD_NUMBER`, `CO_TEST_CARD_HOLDER`, `CO_TEST_CARD_EXPIRY`, `CO_TEST_CARD_CVV` e `CO_TEST_CARD_DOCUMENT`.

S1 falha de forma explícita se faltar massa CO, sem usar a massa MX silenciosamente. S2 continua usando o fluxo conhecido de `getMxTestCard()`. O Jenkins S1 instala a credencial de arquivo `samsung-co-s1-test-card`, já provisionada; S2 mantém `samsung-mx-test-card`. Não é necessário republicar esse cartão em cada refresh da sessão.

O PASS foi obtido com a massa regional injetada no loader anterior. A seleção persistente introduzida depois passou por testes de contrato e comparação exata com o arquivo utilizado no PASS. Uma segunda criação de ordem para repetir a prova com o seletor final foi rejeitada pela revisão automática antes de executar; não houve nova submissão nem tentativa de contornar a rejeição.

## Correções implementadas

- Validação CO S1 reabre o menu de perfil no máximo uma vez se ele fechar durante a renderização; move o ponteiro antes de um novo hover e aguarda o fim da animação. A presença real de logout continua obrigatória; menu deslogado falha imediatamente. Os demais mercados mantêm uma única tentativa por padrão.
- O runner local CO aplica o anotador de known defects após gerar o Executive, como o finalizador Jenkins já faz. O RT-746043 aparece em roxo com link; o layout dos KPIs e o resultado bruto não são alterados.
- O anotador contabiliza cada defeito uma vez quando existem falhas e blockers simultaneamente; preserva o CSS da grade e a contagem bruta.
- Massa de cartão CO S1 separada da massa MX, com credencial própria no Jenkins; fluxo S2 preservado.
- Bootstrap `/getcookie.html` também no CO S1; override `CO_SETUP_URL` restrito à origem do storefront.
- Contato pessoa física quando “Persona Natural” não existe e “Compra (Empresa)” está desmarcado.
- Faturação em formulário novo direto quando os radios de endereço estão desabilitados por ausência de massa salva.
- Rodapé CO S1 valida “Sobre nosotros”; S2 mantém “Account”.
- Pagamento CO exige quantidade 1 e usa evidência da API de pedidos, preservando a confirmação.
- Preparação de janela compartilhada nos refreshes MX/PE/CO/CL: fecha DevTools, maximiza janelas nativas e verifica o resultado. Launchers dedicados MX/PE/CO evitam onboarding e restore bubble.

Evidência da campanha completa: `test-results/co-s1-campaign-refreshed/`, com `runtime-summary.json`, resultados das três fases, screenshots e traces. PASS do cartão regional: `test-results/co-s1-card-co-mastercard/`, incluindo `test-finished-1.png` com o código da ordem. Evidências anteriores: `test-results/co-s1-stabilization/`. Artefatos de runtime/autenticação não são versionados. A validação de refresh em runtime foi feita no CO S1; os demais mercados receberam validação estática/regressão da preparação compartilhada.

Arquitetura e inventário oficial passaram; os 27 testes focados de auth/janela/reporting/cartão/BackOffice CI passaram, assim como a validação do Jenkinsfile no servidor Jenkins. Steps/refactor mantêm as 16 pendências preexistentes de CL, fora deste escopo.
