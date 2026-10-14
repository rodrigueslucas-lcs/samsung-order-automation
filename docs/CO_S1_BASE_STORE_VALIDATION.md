# CO S1 — Base Store P1

Validação local em 14/10/2026, Chrome headed, um worker e sem retries.

Resultado consolidado das últimas execuções de cada SAM: **20 PASS, 4 FAIL e 5 SKIP por pré-requisitos/bloqueios**. Os resultados foram obtidos em rodadas direcionadas; não representam uma campanha única inteiramente verde. O inventário e a cobertura oficial não foram alterados.

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
| 24896 — Logout | SKIP | Falta concluir o login legítimo e exportar/verificar a sessão CO S1 da segunda conta. A abertura desse perfil foi validada: Samsung Account visível, janela maximizada e zero targets DevTools. |
| 24911 — Back to Top | FAIL | Controle ausente no carrinho S1 em 1920×1080 e 1280×720, inclusive após scroll até o rodapé. Requer correção/habilitação da UI. O skip conhecido do S2 não é aplicado automaticamente ao S1. |
| 24912 — Cartão registrado | FAIL | Uma submissão com quantidade 1 recebeu HTTP 200 / `submitOrderDataWsDto` / código `601`; a UI exibiu “Error procesando el pago”. Nenhuma confirmação de ordem foi observada. Falta validar massa de pagamento/configuração do gateway CO S1. Não houve reenvio da tentativa. |
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

## Correções implementadas

- Bootstrap `/getcookie.html` também no CO S1; override `CO_SETUP_URL` restrito à origem do storefront.
- Contato pessoa física quando “Persona Natural” não existe e “Compra (Empresa)” está desmarcado.
- Faturação em formulário novo direto quando os radios de endereço estão desabilitados por ausência de massa salva.
- Rodapé CO S1 valida “Sobre nosotros”; S2 mantém “Account”.
- Pagamento CO exige quantidade 1 e usa evidência da API de pedidos, preservando a confirmação.
- Preparação de janela compartilhada nos refreshes MX/PE/CO/CL: fecha DevTools, maximiza janelas nativas e verifica o resultado. Launchers dedicados MX/PE/CO evitam onboarding e restore bubble.

Evidências locais e consolidação por SAM: `test-results/co-s1-stabilization/`. Artefatos de runtime/autenticação não são versionados. A validação de refresh em runtime foi feita no CO S1; os demais mercados receberam validação estática/regressão da preparação compartilhada.

Arquitetura e inventário oficial passaram. Steps/refactor mantêm as 17 pendências preexistentes de CL, fora deste escopo.
