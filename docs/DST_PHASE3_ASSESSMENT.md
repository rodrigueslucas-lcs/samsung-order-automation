# DST — atualização P1 e diagnóstico MX

Data: 2026-11-25. Baseline de execução: d3145f5. Esta entrega publica uma proposta, evidências de diagnóstico e a correção de trace do piloto existente; não inicia implementação em massa.

## MX — último build auditado

| Lane / build | Revisão executada | Resultado original | Diagnóstico |
|---|---|---|---|
| Samsung-SMB-MX #24 | b6ec2bee8da674e40e789e618067e1d70119de07 | 23 PASS / 6 FAIL | Três casos PreQA perderam a sessão após o preflight; um checkout estourou a recuperação GET; dois pagamentos sem confirmação |
| Samsung-SMB-EPP-MX #12 | 144cc430b8651f019dd1e11c779ef40f6847fb29 | 5 PASS / 1 FAIL / 1 não executado downstream | SAM-25045 ficou no carrinho antes de chegar ao payment; não comprova recusa do cartão |

Não foram disparados novos builds nesta entrega. Os builds auditados são anteriores aos fixes atuais; não atribuir seus resultados ao HEAD atual.

### Base Store: correções anteriores agora revalidadas

O commit 41592e3 já prioriza os três casos PreQA no início da execução S2 e amplia de 60 para 120 segundos a espera da mesma recuperação GET do carrinho MX. O log do build #24 prova documento de carrinho com TTFB de 105676 ms, enquanto a API anterior respondeu 200 em 619 ms. A mudança não adiciona reloads nem repete pagamento.

Foi executada uma revalidação local targeted dos quatro casos, com sessão existente, sem autenticação humana, sem submissão financeira e com lease normal do mercado:

| TC QST | Resultado real desta rodada |
|---|---|
| SAM-24964 — GNB BC | PASS |
| SAM-24968 — facetas BC | PASS |
| SAM-24969 — Add BC QST | PASS |
| SAM-24995 — checkout guest | PASS |

Evidência raw: `test-results/mx-build24-revalidation/1795639899034-65148/results.json`; log de diagnóstico local: `.agent/dst-phase3/mx-regression.log`. O launcher local `.agent/dst-phase3/run-mx-regression.cjs` usa Playwright diretamente para preservar os relatórios anteriores, com os projetos mx-preqa-priority/chromium, seleção exclusiva desses quatro IDs, um worker, zero retries, guards financeiros desligados e todos os artefatos isolados. Os quatro resultados não aprovam a suíte completa.

Após o hook opcional de trace, o Add BC QST SAM-24969 foi executado novamente e passou (um TC, 3,5 minutos totais), provando que o fluxo padrão continua adicionando o SKU e validando sua persistência. Evidência: `test-results/mx-bc-trace-hook-revalidation/1795643153520-28680/results.json`. O [registro da Fase 3](../governance/dst-phase3-validation.json) contém os hashes de código e evidências e separa esse PASS QST do FAIL DST.

SAM-25002 e SAM-25010 continuam com o resultado financeiro original não resolvido: código 601, mensagem de transação malsucedida e ausência de confirmação causal. Não foram reenviados nesta fase, limitada à proposta P1 e à revalidação não financeira. Não há evidência suficiente para atribuir esses dois resultados exclusivamente ao cartão ou ao ambiente. Qualquer tentativa com resultado incerto deve ser reconciliada antes de uma nova submissão.

### EPP

Os fixes posteriores ao build #12 tratam sobreposição/erro operacional do carrinho e leitura/reconciliação de pagamento. Isso não comprova que SAM-25045 passou. O caso financeiro não foi executado nesta rodada e continua sem nova evidência de aprovação. O ledger consultado separadamente não tinha tentativa Card pendente, mas tinha Cash antigo em SUBMITTING sem resultado reconciliado. Nenhum ledger foi apagado, reclassificado ou usado para afirmar falha de Card por causa de Cash.

## SAM-24969 — requisito DST e massa BC

O export MX_QST_37, A34:I34, exige preço e cor além de Add to Cart. O PASS QST acima não satisfaz automaticamente esse requisito adicional.

No Fold6 SM-F956BAKMLTM, a inspeção encontrou dispositivo e memória selecionados, mas nenhum seletor nativo de cor do produto principal. Os controles de cor de acessórios não são aceitos. O resultado histórico DST permanece FAIL, com a assinatura DST_BC_COLOUR_NOT_RENDERED e o erro independente de trace.

Foram inspecionados os produtos e links realmente presentes no catálogo autorizado. O Galaxy A06 SM-A065MLBALTM apareceu com pd-color selecionado Azul Claro, memória 64 GB e data-modelprice 2599. Seu link nativo é `/mx/smartphones/galaxy-a/galaxy-a06-light-blue-64gb-sm-a065mlbaltm/buy/`. Isso o torna candidato de massa; não comprova ainda o fluxo completo de serviços, CTA habilitado e persistência no carrinho. Uma segunda leitura confirmou o input de cor anexado, mas não encontrou preço, CTA ou serviço nos seletores sondados. Essa sondagem parcial não prova ausência funcional; ainda é necessário confirmar os seletores e a prontidão desse layout. Não foi introduzida substituição automática, selector permissivo ou fallback inventado.

Próxima validação restrita: comprovar preço visível, cor/memória/SKU do mesmo produto, configuração nativa de serviços e CTA habilitado. Somente então adaptar a configuração DST do caso existente, mantendo o Fold6 QST e suas validações. Nenhum novo PASS DST foi declarado e os snapshots anteriores permanecem intactos.

Diagnósticos locais: `.agent/dst-phase3/bc-audit.json`, `bc-variants.json`, `bc-a06-variant.json` e `a06-control-proof.json`. A sessão PreQA válida e as abas do operador foram preservadas; não foi solicitado login.

## EBUSY — defeito separado de arquivamento

O EBUSY foi reproduzido em dois testes sintéticos locais com CDP, sem loja, produto ou autenticação: duas falhas e zero arquivos ZIP. O Playwright instalado tenta rename direto quando há apenas um fragmento de trace; essa operação falhou. A causa do bloqueio do arquivo pelo Windows não foi identificada, portanto não se atribui a antivírus ou processo específico.

Uma experiência usando somente a API pública context.tracing.start/stop, finalizando a captura do contexto CDP real antes de fechar a página e desconectar, passou 2/2 e produziu dois ZIPs válidos com trace.trace, trace.network, snapshots e recursos. Evidências: `.agent/dst-phase3/trace-diagnostic/proof.json`, `manual-proof.json` e os logs correspondentes. São testes de artefato, não TCs oficiais.

A alternativa foi incorporada somente ao piloto DST BC, por um hook opcional no fluxo compartilhado. O caminho QST padrão não solicita essa captura. A API pública gera um ZIP obrigatório com browser trace e network, validado antes de anexar o artefato; erros simultâneos de negócio/trace são preservados. O tracing automático apenas do test runner foi substituído pela captura real do contexto CDP, não simplesmente desativado. Nenhuma dependência ou arquivo node_modules foi modificado.

Validação: seis testes de contrato PASS, dois testes reais isolados com a implementação final PASS e uma execução targeted real do SAM-24969 DST. O TC real continua FAIL por DST_BC_COLOUR_NOT_RENDERED, antes de Add, mas produziu um trace válido de 16403169 bytes, sem EBUSY ou falha de arquivamento. Evidência: `test-results/dst/mx/base_store/p1/1795643040697-89544/results.json`; hash do trace anexado: `1211f05f7cdff2ed6144a48917dd5f0407523af56c2384cb16907340586263a5`. O resultado original da Fase 2 não foi sobrescrito. A primeira tentativa deste reteste retornou AUTH_BUSY antes de iniciar o TC; a execução ocorreu após liberação normal do lease, sem takeover ou renovação de sessão.

Correção de disponibilidade de evidência histórica: os fragmentos ZIP do run DST antigo não estavam mais presentes no diretório temporário na inspeção atual. Permanecem results.json, screenshot e error-context. A menção anterior a material de trace não arquivado não garante que esse material ainda esteja recuperável.

## Sondagem Windows de propriedade do perfil

O primeiro gate integrado terminou com 1777 PASS e uma falha no fixture Windows que relança um Chrome temporário: AUTH_BROWSER_ENDPOINT_UNAVAILABLE, antes de autorizar o launch, porque a sondagem retornou estado inconclusivo. O mesmo arquivo passou 13/13 isoladamente antes da alteração. A causa externa da leitura inconclusiva do Windows não foi identificada; não se atribui a sessão vencida, CAPTCHA, conta ou erro da loja.

O helper agora relê no máximo três vezes somente uma sondagem inconclusiva, com intervalo de 200 ms. Cada chamada nativa conserva seu timeout de 20 segundos; o limite dessa etapa pode chegar a 60,4 segundos, sem alterar o caminho normal que já tem prova válida. Depois disso, a incerteza ainda retorna exit 73, sem remover ponteiro nem abrir janela. Perfil ambíguo, endpoint inválido, mudança de PID/data de criação e erro ao gravar metadados continuam rejeitados. A releitura também não pode legitimar um processo substituto durante a confirmação final.

Não foram alterados credenciais, sessões, configuração corporativa ou mecanismos de autenticação. Os testes Windows usam somente perfis temporários próprios, sem login no Samsung Account. O primeiro resultado de gate e a revalidação final são preservados separadamente.

## Expansão proposta e lacunas

Ver [proposta P1](DST_P1_EXPANSION_PROPOSAL.md): 144 identidades P1, 14 candidatos de leitura, 60 de carrinho/cotação, nove pilotos preservados. As 135 revisões semânticas restantes não foram declaradas concluídas. P2: inventário de 218, zero definições detalhadas aprovadas; workbook adicional somente candidato, com 213 matches por descrição e cinco ambiguidades.

Nenhuma campanha completa, pagamento, novo pedido, alteração de pipeline QST, renovação desnecessária de sessão ou operação no remoto corporativo foi realizada.

## Validação final da entrega

- `npm run repo:refactor:gate`: PASS no código final. Inclui arquitetura, auditorias de fronteiras, escopo oficial, passos QST, discovery dos quatro mercados e DST, 1789 testes de governança, 4 de Executive e 39 de reporting MX; zero FAIL e zero SKIP. Esse resultado é estático/discovery/regressão de componentes, não uma campanha comercial completa.
- Testes focados de auth/trace/proposta: 29 PASS; após a revisão dos passos, os seis testes da proposta foram reexecutados e passaram. A releitura Windows e os dois testes reais de Chrome também passaram dentro do gate final.
- Discovery targeted dos nove pilotos existentes: MX 4, PE 3, CO 1 e CL 1. Discovery não foi contabilizado como runtime PASS.
- Runtime real nesta rodada: quatro TCs QST MX PASS; SAM-24969 QST novamente PASS após o hook; SAM-24969 DST FAIL por cor, com trace válido e sem EBUSY. Os outros oito resultados DST continuam sendo os resultados preservados da Fase 2.
- Revisão de arquivos da entrega e `git diff --check`: sem dados de cartão, credenciais, sessões, artefatos runtime ou arquivos locais de agentes para publicação.

Log do gate final: `.agent/dst-phase3/refactor-gate-final.log`. A primeira execução com 1777 PASS e uma falha permanece em `refactor-gate.log`, separada do resultado final após a correção. Os artefatos brutos continuam locais e ignorados pelo Git; o registro versionado contém referências e hashes.
