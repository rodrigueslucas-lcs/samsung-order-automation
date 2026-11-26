# DST P1 — proposta de expansão por mercado e loja

Data: 2026-11-25. Baseline: d3145f5. Proposta anterior à implementação em massa.

## Escopo e estado real

São 144 P1: MX 37, PE 34, CO 35 e CL 38. O inventário de 218 P2 permanece separado. Nenhum TC novo foi implementado ou liberado pelo runner nesta entrega.

Os nove pilotos históricos da Fase 2 continuam com **8 PASS e 1 FAIL**. Os outros 135 P1 permanecem NOT_RUN no DST. Um owner QST encontrado por discovery comprova uma oportunidade de reúso, não cobertura semântica, execução DST ou homologação.

A matriz [dst-p1-expansion-proposal.json](../governance/dst-p1-expansion-proposal.json) registra cada identidade mercado/loja/SAM, arquivo e célula do export, hash, pré-condições, passos, resultado esperado, owner Playwright descoberto, imports reutilizáveis e verificações ainda necessárias. A comparação dos 135 candidatos é estática; a revisão cláusula a cláusula fica obrigatória em cada lote antes de sua implementação. Não se declara essa revisão concluída.

## Quantidade e prioridade

W1: leitura. W2: carrinho e cotação sem envio financeiro. W3: alterações controladas de perfil/BackOffice ou identidades independentes. W4: pagamento, pedidos ou ciclo de vida com autorização específica. HOLD: impedimento já identificado, sem classificação automática como bug do produto.

| Mercado / loja | P1 | Pilotos | PASS/FAIL históricos | W1 | W2 | W3 | W4 | HOLD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| MX / Base Store | 30 | 4 | 3/1 | 4 | 9 | 6 | 5 | 2 |
| MX / EPP | 7 | 0 | 0/0 | 1 | 4 | 0 | 2 | 0 |
| PE / Base Store | 28 | 3 | 3/0 | 1 | 13 | 4 | 7 | 0 |
| PE / EPP | 6 | 0 | 0/0 | 1 | 3 | 0 | 2 | 0 |
| CO / Base Store | 29 | 1 | 1/0 | 4 | 11 | 6 | 3 | 4 |
| CO / EPP | 6 | 0 | 0/0 | 1 | 4 | 0 | 1 | 0 |
| CL / Base Store | 31 | 1 | 1/0 | 1 | 13 | 5 | 9 | 2 |
| CL / EPP | 7 | 0 | 0/0 | 1 | 3 | 0 | 3 | 0 |

## Sequência proposta

1. Consolidar os nove pilotos, mantendo suas evidências originais. O arquivamento do trace do SAM-24969 foi corrigido e comprovado no reteste real; a massa com cor selecionável e o fluxo completo de serviços/CTA/carrinho continuam pendentes. Não remover a validação de cor. Ver [evidências da Fase 3](../governance/dst-phase3-validation.json).
2. Revisar e implementar pequenos lotes W1 por mercado. Há 14 candidatos: potencial de 23 TCs implementados contando os nove existentes. A aprovação depende da comprovação dos requisitos em execução DST.
3. Expandir W2 por loja após comprovar sessão, massa e guardas: mais 60 candidatos; teto proposto de 83 implementados, aproximadamente 58% dos 144. A estimativa é de capacidade, condicionada aos requisitos detalhados e ao ambiente.
4. Manter os 21 W3 e 32 W4 fora das execuções desta fase. Revisar individualmente oito HOLD. Não substituir dados, remover assertions ou importar skips para alcançar a estimativa.

Primeiros candidatos W1, sujeitos à conferência integral das cláusulas do export:

- **MX:** SAM-24963 (BASE_STORE), SAM-24964 (BASE_STORE), SAM-24968 (BASE_STORE), SAM-25011 (BASE_STORE), SAM-25020 (EPP).
- **PE:** SAM-25103 (BASE_STORE), SAM-25109 (EPP).
- **CO:** SAM-24873 (BASE_STORE), SAM-24874 (BASE_STORE), SAM-24875 (BASE_STORE), SAM-24879 (BASE_STORE), SAM-24929 (EPP).
- **CL:** SAM-24784 (BASE_STORE), SAM-24836 (EPP).

Esforço relativo por TC: W1 baixo a médio; W2 médio; W3/W4 alto; HOLD sem estimativa até resolver o pré-requisito. Não há estimativa em dias sem concluir a revisão e o primeiro lote por loja.

## Reaproveitamento e limites

A classificação considera também os passos e resultados esperados, não apenas o título. SAM-24786, SAM-25057, SAM-24919 e SAM-25010 exigem Place order no export e ficam em W4; histórico/rastreamento QST com pedido antigo não comprova esse requisito DST. SAM-24896 e SAM-24986 exigem isolamento entre contas e ficam em W3. Casos de UI em all pages exigem uma matriz de páginas acordada, não uma única página ou viewport. SAM-24962 MX contém uma URL CO no texto oficial e fica em HOLD até esclarecimento, sem trocar silenciosamente o país.

- Base Store: reutilizar HomePage, ProductPage, CartPage, CheckoutPage, Page Objects de conta e BackOffice; adaptar somente lacunas demonstradas. Não copiar specs QST para alterar a tag.
- PE Rewards: preservar tooltip e texto em Cart, Checkout e Payment. O fluxo registrado PE não é um adaptador universal para os outros mercados.
- CO/CL BackOffice: reutilizar o fluxo read-only comprovado e seus Page Objects. A confirmação do operador sobre a pré-condição genérica de payment vale para SAM-24920 e SAM-24830; não extrapolar aos demais.
- EPP: os 26 owners QST foram encontrados, mas utils/eppTestFixtures.js reconhece /qst/epp/ e anota suite QST. Preparar um adaptador DST explícito usando sessão, guardas e prova do servidor existentes antes de novos casos. Não importar a fixture inalterada nem compartilhar reporting como QST.
- BC: manter a sessão WMC válida, prova do SKU e da variante, preço e cor nativos, Add único e persistência no carrinho. Cor de acessório não satisfaz a seleção do produto principal.
- SAM-24806 consta explicitamente nos exports de CO e CL; a identidade deve conter mercado e loja. Não deduplicar nem inventar um SAM substituto.
- SAM-25002 e SAM-25045 têm diferença no campo steps entre workbook e CSV. A divergência está registrada; confirmar a revisão oficial antes da implementação financeira.

Para promover cada candidato: registrar todas as cláusulas com assertion/fluxo e evidência, identificar pré-requisito real, implementar owner canônico individual, executar discovery e gates e então runtime targeted com evidência DST. Resultado QST anterior nunca substitui essa sequência.

## P2 — solicitação à Samsung/Jira/Zephyr

O [inventário P2](../governance/dst-p2-source-inventory.json) mantém 218 linhas canônicas e zero definições detalhadas aprovadas. Um workbook adicional STG SMB.xlsx foi localizado, mas sua versão e autoridade não estão confirmadas. Há 213 correspondências candidatas por descrição completa normalizada dentro do mesmo mercado/loja e cinco ambíguas. O alinhamento apenas pela posição é inválido: 44 descrições divergem nas mesmas posições. Nenhum desses candidatos foi promovido a TC oficial executável.

Solicitar:

1. Export aprovado e atual de DST P2, owner, data/revisão, projeto/ciclo e ambiente.
2. Identidade oficial SAM ou confirmação explícita do identificador de cenário, com vínculo à linha canônica e à loja/programa.
3. Passos numerados, pré-condições, resultados esperados por etapa e dados de teste controlados, sem credenciais em exports compartilhados.
4. Resolução das cinco correspondências ambíguas: MX-BASE_STORE-14, PE-BASE_STORE-13, CL-BASE_STORE-13, CO-BASE_STORE-14 e MX-EPP-31.
5. Confirmação de prioridade P1/P2; High/Critical do workbook não é equivalente a essa classificação.

Até lá: somente inventário, oportunidades de Page Objects e preparação de arquitetura, sem specs oficiais P2.

## Execução e preparação Jenkins

Preservar o runner targeted existente: seleção explícita por mercado, loja, prioridade e IDs; nenhum default de campanha completa. Manter artefatos separados em test-results/dst/<mercado>/<loja>/<prioridade>/<execução>, lease por mercado, um worker e zero retries financeiros. Não renovar sessão apenas por existir ou faltar um arquivo; provar sua validade primeiro.

Exemplo de discovery do piloto existente, sem execução de negócio:

    npm run dst:run -- MX --store BASE_STORE --priority P1 --ids SAM-24969 --list

Planejar jobs DST independentes, com parâmetros MARKET, STORE, ENVIRONMENT, PRIORITY e TARGET_IDS, consumindo o mesmo runner e reporting DST. Autenticação existente deve ser verificada antes da lane. Nenhum job ou pipeline QST é alterado nesta entrega; nenhuma campanha Jenkins DST é disparada.

## Fontes e auditoria

P1: Samsung_MX_QST_37_TCs_Detalhados.xlsx (MX_QST_37), Samsung_PE_QST_34_TCs_Detalhados (1).xlsx (PE_QST_34), exports detalhados CO/CL e PE_QST_34.csv (144 registros LATAM), com células e hashes por TC na matriz. A origem offline fornecida pelo operador é preservada; não se declara verificação atual no conector Jira.

Escopo canônico: docs/smb_priority_templates/STG-{MX,PE,CO,CL}-Smoke-Test-Template.md. Snapshots das Fases 1/2 têm hashes normalizados LF na proposta e permanecem intactos. Material sensível embutido nas fontes foi redigido apenas nas cópias de análise; originais, autenticação e sessões não foram alterados.
