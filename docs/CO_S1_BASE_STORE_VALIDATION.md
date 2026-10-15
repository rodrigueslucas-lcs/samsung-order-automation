# CO S1 — Base Store P1

Validações locais em 14 e 15/10/2026, Chrome headed/headless, um worker e sem retries.

Última campanha completa: **20 PASS, 5 FAIL brutos e 4 SKIP**, com os 29 SAMs representados e **zero NOT_RUN**. O dashboard separa um dos cinco FAIL como **KNOWN DEFECT**, vinculado ao RT-746043: visualmente são 20 PASS, 4 FAIL, 4 BLOCKED e 1 KNOWN DEFECT. O inventário e a cobertura oficial não foram alterados.

O refresh primary terminou em READY após CAPTCHA humano, com logout confirmado em contexto novo. Os dois casos do gate de autenticação passaram e o runner executou os demais 27 casos. O BackOffice SAM-24920 passou usando a credencial compartilhada S1, sem alteração de ordem.

Depois da campanha, **SAM-24912 passou isolado**, com quantidade 1, zero retries e confirmação Samsung visível da ordem **CO261014-64013543**. Foi usada a Mastercard sandbox específica de CO, extraída da documentação oficial do Mercado Pago; a massa MX usada antes recebia rejeição 601. Em 15/10, SAM-24880 e SAM-24919 também passaram isolados. Após desativação da promoção de boas-vindas, o SAM-24896 também passou isolado. Considerando o último resultado local observado de cada SAM: **24 PASS, 1 FAIL, 3 SKIP e 1 KNOWN DEFECT**; essa consolidação de execuções direcionadas não representa uma nova campanha completa. O relatório da campanha anterior continua preservado com seus resultados originais.

O **SAM-24896 está PASS no CO S1**, após o operador desativar `CO_Welcome_28112025`. A execução oficial comprovou login, logout, SKU RF32CG5910B1CO e quantidade 1 preservados, com total **$15.199.900 antes e depois**. A API confirmou desconto zero e nenhuma promoção aplicada. A asserção original não foi alterada; a second termina deslogada pelo objetivo do próprio TC.

## Casos verdes

| Área | SAMs com PASS local |
| --- | --- |
| Login e conta | 24873, 24874 |
| Desktop, GNB e PLP | 24806, 24875, 24879 |
| Carrinho | 24882, 24883, 24886, 24896 |
| Checkout e endereços | 24898, 24899, 24900, 24901, 24902, 24903, 24904, 24905, 24909, 24910 |
| BC e tracking | 24880, 24919 |
| Pagamento registrado | 24912 |
| BackOffice | 24920 |
| Mobile | 24925 |

O SKU `RF32CG5910B1CO` está utilizável no S1. Os casos de salvar/editar criaram endereços QA no sandbox primary; esses registros foram mantidos intencionalmente como massa para a reexecução de selecionar endereço salvo e alternar modos. Os endereços preexistentes não foram descartados.

## Pendências concretas

| SAM | Resultado bruto | Evidência / pré-requisito necessário |
| --- | --- | --- |
| 24880 — BC | PASS direcionado | Catálogo e PDP CO no PreQA autenticado, SKU RF32CG5910B1CO, POST de adição bem-sucedido e aumento/persistência do minicarrinho. O frontend é PreQA2 e o backend observado é S2, inclusive quando o SAM pertence à campanha S1. Não é uma prova de adição pelo frontend nativo S1. |
| 24892 — SC+ | SKIP | O caso oficial continua bloqueado. Geladeira `RF32CG5910B1CO` e S24 Ultra `SM-S928BZTKLTC` entram no carrinho S1, mas não oferecem Care+. Falta SKU elegível e fluxo BC/PDP de staging para validar a adição. |
| 24893 — Trade-up | FAIL | Nenhum dos dois SKUs conhecidos mostrou Trade-up/Plan Canje/Renueva no carrinho S1. Falta uma oferta/SKU elegível habilitada nesse ambiente. |
| 24896 — Logout | PASS direcionado | Promoção CO_Welcome_28112025 desativada pelo operador. Uma execução oficial verde, sem retry: login e logout comprovados, RF32CG5910B1CO quantidade 1 e total $15.199.900 preservados. API sem desconto/promoções. Evidência: co-s1-24896-promotion-disabled-final. |
| 24911 — Back to Top | FAIL bruto / KNOWN DEFECT no dashboard | Controle ausente após scroll e rodapé carregado. Bug [RT-746043](https://jira.secext.samsung.net/browse/RT-746043), já mapeado para PE/CO S1/S2. Requer correção da UI; o resultado bruto permanece intacto. |
| 24912 — Cartão registrado | PASS direcionado | Ordem CO261014-64013543 confirmada na Samsung usando a Mastercard sandbox regional CO. A rejeição 601 anterior ocorreu com a massa MX. O seletor final lê a massa CO S1; S2 preserva sua seleção anterior. |
| 24914 — ADDI | SKIP | Bloqueio oficial existente: depende de fluxo/callback sandbox aprovado e operações PSE/BO/Kibana. |
| 24915 — Rewards | SKIP | Bloqueio da implementação oficial atual. Requer massa e fluxo de resgate/pagamento com pontos aprovados; texto de Rewards no carrinho não prova pagamento. |
| 24919 — Tracking | PASS direcionado | Nova ordem guest CO261015-64014952, quantidade 1, confirmação Samsung e tracking da mesma identidade na mesma execução. Detalhes exibem Pago confirmado, SKU e total $15.199.900. S1 usa a consulta pedido/e-mail que a UI oferece; S2 mantém OTP. |

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

O **SAM-24919 sempre cria uma ordem guest nova em cada execução**, tanto no S1 quanto no S2. Exige `ALLOW_PAYMENT_SUBMIT=1`, carrinho com quantidade 1, uma única submissão, confirmação Samsung visível e correspondência entre a resposta do checkout e o número público da ordem. Em seguida rastreia esse mesmo número/e-mail e valida status, detalhes, produto e resumo. O CO S1 oferece consulta direta por pedido/e-mail na UI; o CO S2 mantém a verificação OTP. O modo direto é restrito à origem e à rota CO S1, e falha se aparecer um requisito de OTP inesperado. Não há retry automático de pagamento após resultado ambíguo.

O arquivo ignorado `playwright/.auth/co-s1-guest-tracking.json` guarda apenas o recibo da última criação para investigação, com mercado, ambiente, SKU, ordem e mailbox. O TC não lê esse arquivo para reutilizar uma ordem anterior, e `CO_QST_TRACKING_CREATE_ORDER` não controla mais esse comportamento. Para evitar criação de pedido, exclua o SAM do filtro da campanha ou mantenha o opt-in de pagamento desligado. Não inclua tokens, cookies ou OTP no recibo.

### BC no PreQA

O SAM-24880 usa uma aba própria na sessão WMC/PreQA aberta em `PREQA2_CDP_URL` (padrão `http://127.0.0.1:9223`). Não navega nem fecha as abas existentes do operador. Abre `/co/refrigerators/all-refrigerators/`, seleciona o SKU controlado e adiciona pelo PDP. O override `CO_QST_BC_URL` deve ser uma URL/caminho CO no próprio `https://p6-pre-qa2.samsung.com`; Production e caminhos de outro mercado são rejeitados antes de abrir a conexão.

As evidências registram o frontend PreQA, a origem real do backend de comércio S2 e os contadores antes/depois. A captura anexada é da aba real do BC, nunca da janela de login WMC ou de uma página S1 não relacionada.

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

## Follow-up de 15/10/2026

Execuções direcionadas, sempre `--project=chromium --workers=1 --retries=0`, com `CO_QST_ENVIRONMENT=S1`:

- `--grep SAM-24880`: PASS, `test-results/co-24880-preqa-live/`; catálogo/PDP PreQA autenticado e mutação real do minicarrinho S2.
- `--grep SAM-24896 --headed`: FAIL na igualdade de total, `test-results/co-s1-final-24896/`; autenticação second renovada manualmente, verificação fresca READY, logout real e SKU preservado. Trace mostra $3.039.980 de desconto antes do logout e sua remoção depois.
- `--grep SAM-24919`: PASS, `test-results/co-s1-final-24919/`, com `ALLOW_PAYMENT_SUBMIT=1 MX_QST_HEADLESS=1`. Ordem CO261015-64014952 criada e confirmada, depois consultada e expandida no tracking. Capturas preservadas nesse diretório. Nenhuma ordem antiga foi reutilizada pelo TC.

Os 12 testes focados de cartão/identidade de tracking/modos S1-S2/limites PreQA passaram. Arquitetura e inventário oficial passaram. Steps/refactor continuam sinalizando as 16 pendências CL preexistentes. S2 não foi reexecutado nesta rodada; preservação de OTP e recusa de consulta direta fora de CO S1 verificadas por contrato. Não houve nova campanha completa nem build Jenkins nesta rodada.

## SAM-24896 — histórico com a promoção ativa

Em 15/10/2026, os três SKUs fornecidos foram executados separadamente no TC oficial CO S1. Cada rodada limpou o carrinho pela UI, adicionou somente o SKU selecionado, comprovou quantidade 1, autenticou a conta e executou logout real. Nenhum pagamento foi enviado.

| SKU | Total logado | Total após logout | Resultado |
| --- | --- | --- | --- |
| SM-F956BDBKCOO | $10.602.900 | $11.781.000 | FAIL: desconto de $1.178.100 removido |
| WA21CG6746BVCO | $2.969.910 | $3.299.900 | FAIL: desconto de $329.990 removido |
| SM-F936BZAJLTC | $7.559.928 | $8.399.920 | FAIL: desconto de $839.992 removido |

Os PDPs mostram o mesmo preço público para cliente autenticado e visitante. Nos três carrinhos, a API identifica `appliedOrderPromotions` com **CO_Welcome_28112025**, que aplica exatamente 10% ao pedido logado; após logout, a lista de promoções fica vazia e o desconto zera. A diferença não é exclusiva de um SKU nem de quantidade acumulada. Esse histórico mostra a causa da divergência com a promoção ativa. Após sua desativação pelo operador, a revalidação passou; a igualdade original do total foi preservada, sem skip ou known-defect artificial.

O preparo anterior acrescentava o SKU ao carrinho existente. O TC agora limpa o carrinho antes da adição, exige um único campo Quantity com valor 1 antes/depois do logout e anexa as duas capturas e os totais ao registro de negócio. S2 não foi reexecutado nesta investigação.

Comando de cada execução, substituindo o SKU e a pasta de evidência:

```bash
CO_QST_ENVIRONMENT=S1 CO_QST_SKU=SM-F956BDBKCOO ALLOW_PAYMENT_SUBMIT=0 CO_AUTH_AUTO_RENEW=0 npx playwright test tests/markets/co/qst/base-store/official-p1.spec.js --project=chromium --workers=1 --retries=0 --grep SAM-24896 --headed --reporter=list --output=test-results/co-s1-24896-products/fold6
```

Evidências locais ignoradas: `fold6/`, `washer-verified/`, `fold4/` dentro de `test-results/co-s1-24896-products/`; `cart-promotions.json` contém apenas os valores e códigos públicos de promoção extraídos dos traces. A tentativa inicial `washer/` encontrou sessão encerrada pelo logout anterior e não foi considerada comparação de preço.

O logout invalida a second entre as rodadas: houve renovação humana e verificação em contexto novo. Antes do Fold4, a janela do login foi encerrada durante o retorno; exportar a sessão já autenticada e verificá-la em contexto novo resolveu o pré-requisito sem repetir o login. A first foi preservada. Ao terminar, a second está deslogada pelo próprio objetivo do TC e precisa de novo refresh antes de reutilização autenticada.

Arquitetura e inventário oficial passaram. Steps/refactor mantêm as 16 pendências CL preexistentes. Não houve nova campanha completa, build Jenkins, publicação de sessão ou alteração de inventário/payment profile.

## SAM-24896 — revalidação PASS após desativação

Em 15/10/2026: **1 passed, 0 failed, 0 skipped**, execução headed, um worker e zero retries. A segunda conta foi renovada pelo operador antes do teste. Carrinho isolado com RF32CG5910B1CO, quantidade 1; total $15.199.900 antes/depois do logout; resposta de carrinho com desconto 0 e promoções vazias. Não houve pagamento ou mudança adicional de código.

```bash
CO_QST_ENVIRONMENT=S1 CO_QST_SKU=RF32CG5910B1CO ALLOW_PAYMENT_SUBMIT=0 CO_AUTH_AUTO_RENEW=0 PW_TRACE=1 npx playwright test tests/markets/co/qst/base-store/official-p1.spec.js --project=chromium --workers=1 --retries=0 --grep SAM-24896 --headed --reporter=list --output=test-results/co-s1-24896-promotion-disabled-final
```

Evidência: `test-results/co-s1-24896-promotion-disabled-final/`, incluindo trace, captura final, `.last-run.json` verde e `cart-business-evidence.json` com apenas os valores de negócio. Os testes anteriores permanecem como histórico da promoção ativa. S2, campanha completa e Jenkins não foram reexecutados nesta revalidação.
