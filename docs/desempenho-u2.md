# Unidade 2 — avaliação de desempenho (critérios 2.1 e 1.5)

## Ambiente e escopo

Data de conclusão da medição CPU: 2026-10-28T21:21:42.433786-03:00.
Sistema: Windows-11-10.0.26300-SP0. Python: 3.13.7 (tags/v3.13.7:bcee1c3, Aug 14 2025, 14:15:11) [MSC v.1944 64 bit (AMD64)].
CPU identificada pelo Python: AMD64 Family 23 Model 104 Stepping 1, AuthenticAMD; 16 processadores lógicos.
Processos de cálculo: 4; repetições por cenário: 5.

A máquina da execução original foi identificada pelo Windows como AMD Ryzen 7 5700U,
8 núcleos físicos / 16 lógicos e aproximadamente 11,35 GiB de RAM visível.
Node.js da execução original: 25.1.0; Windows 11 Pro. As medidas são locais,
com aplicações de desktop abertas, sem isolamento de CPU, frequência ou temperatura.
Houve verificações curtas de desenvolvimento durante parte da execução CPU;
a alternância de ordem e cinco repetições reduzem, mas não eliminam interferência.
A carga HTTP foi executada depois do benchmark CPU. Não generalizar estes números
para produção, outros computadores ou para o checkout.

## Metodologia do processamento paralelo

Tarefa real: gerar quatro sugestões para cada página de produto do catálogo.
Cada origem é comparada a todos os demais produtos por técnica, região e
similaridade textual. Complexidade aproximada O(N² × custo da similaridade).
O código medido é o mesmo importado pelo serviço Python e utilizado no lote HTTP.
Não há sleep, simulação de demora ou processamento repetido só para inflar a carga.

Massa sintética determinística (semente 42): descrições de 12 palavras, quatro
técnicas e quatro regiões. A distribuição sintética correlaciona técnica e região;
isso limita a representatividade dos rankings. O benchmark não mede qualidade
das recomendações e não usa pedidos reais. O banco de desenvolvimento não é alterado.

Sequencial e paralelo usam exatamente a mesma função, entradas, desempates e limite.
Há aquecimento prévio e alternância da ordem sequencial/paralelo a cada repetição.
O paralelo usa ProcessPoolExecutor com spawn; inclui serialização, envio e coleta
dos resultados. Pool persistente exclui criação dos processos. O cenário frio
mede separadamente criação, cálculo e encerramento dos processos em cada repetição.
A medição usa perf_counter. Equivalência exata é verificada em cada execução,
além de hashes SHA-256 armazenados no CSV. Falha de equivalência interrompe o teste.

## Resultados CPU: mediana de 5 repetições

| Produtos/origens | Sequencial (s) | Paralelo ativo (s) | Paralelo frio (s) | Speedup ativo | Speedup frio |
| --- | --- | --- | --- | --- | --- |
| 16 | 0.0798 | 0.0245 | 0.3078 | 3.25x | 0.26x |
| 128 | 4.5054 | 1.2504 | 1.6678 | 3.60x | 2.70x |
| 384 | 42.6070 | 17.7604 | 16.9809 | 2.40x | 2.51x |

Speedup = mediana sequencial / mediana paralela. Valor >1 indica ganho;
valor <1 indica perda. Throughput CPU é origens processadas por segundo,
calculado por execução no CSV. Amplitudes mínimo/máximo estão no JSON.

### Interpretação

O pool ativo pode dividir rankings independentes entre núcleos. O ganho não é
automaticamente igual ao número de processos: serialização do catálogo, coleta,
ordenação, despacho e limitações da máquina também têm custo. O cenário frio
mostra se criar processos para um único lote compensa. Na carga pequena, esse
custo pesa muito; manter um pool no serviço evita pagá-lo a cada chamada.
Na maior massa (384 produtos), o pool ativo variou de 11.34 a 18.59 s.
Consulte a tabela para comparar as medianas fria e ativa. Frio significa processos novos,
não máquina fria. Não houve controle térmico nem isolamento de escalonamento:
uma eventual mediana fria menor não comprova vantagem intrínseca de recriar processos.
Por isso, a consulta de uma única página usa sequencial por padrão, e lotes
permitem paralelo explicitamente. A transferência do catálogo por tarefa é
simples para estudo, mas limita escala; memória compartilhada/particionamento
e cache exigiriam nova medição, não são ganhos presumidos.

## Benchmark HTTP ponta a ponta

Ferramenta: benchmarks/carga_http.py, urllib + ThreadPoolExecutor. Circuito fechado:
cada trabalhador envia a próxima chamada depois de concluir a anterior.
Cenários com concorrência 1 e 4, 40 requisições de catálogo por cenário e
10 de recomendações por modo/cenário; uma chamada de aquecimento antes de cada rota.
Banco local com três produtos do seed, ambos os serviços no mesmo computador.
Latência inclui HTTP, consulta Prisma, serialização e, nas recomendações,
a segunda chamada HTTP ao Python. Pool Python persistente de quatro processos.
p95 calculado por nearest rank. Throughput conta todas as respostas; erros
são explicitamente mostrados. A duração inclui criação/encerramento das threads
do cliente. É teste exploratório curto, uma rodada por cenário, não teste de
saturação nem estimativa robusta da capacidade máxima. CPU tem cinco repetições;
HTTP conserva todas as amostras individuais e não estima intervalos de confiança.

| Cenário | Concorrência | Requisições | Erros | respostas/s | sucessos/s | Mediana (ms) | p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| catalogo | 1 | 40 | 0 | 51.92 | 51.92 | 16.51 | 31.13 |
| catalogo | 4 | 40 | 0 | 108.12 | 108.12 | 23.42 | 92.75 |
| recomendacao_sequencial | 1 | 10 | 0 | 41.33 | 41.33 | 27.43 | 38.98 |
| recomendacao_sequencial | 4 | 10 | 1 | 106.52 | 95.87 | 26.70 | 43.95 |
| recomendacao_paralela | 1 | 10 | 0 | 36.82 | 36.82 | 30.26 | 38.62 |
| recomendacao_paralela | 4 | 10 | 1 | 104.61 | 94.15 | 31.52 | 46.05 |

### Relação com a arquitetura

Separar Python adiciona uma ida HTTP e conversão JSON; a separação não promete
reduzir latência de uma chamada pequena. O ganho comprovado de CPU refere-se
ao lote, não à página com três produtos. Em uma origem pequena, o despacho ao
pool pode aumentar latência; por isso os dois caminhos existem. Concorrência
no cliente HTTP aumenta requisições em voo, mas é diferente de paralelismo de
CPU nos processos. Comparar as linhas de cada cenário antes de atribuir ganho.
Quando throughput sobe com p95 maior, há maior sobreposição de chamadas com
mais espera por requisição. O banco e a comunicação continuam custos compartilhados.
Falhas registradas por cenário/concorrência/quantidade: [('recomendacao_sequencial', 4, 1), ('recomendacao_paralela', 4, 1)].
Na rodada original, houve dois 503: um em cada modo com concorrência 4.
Isso decorre do limite de dois cálculos admitidos no Python e não comprova
capacidade sustentável sem erros. Se houver falhas, o script retorna código 1 e
preserva essas falhas no JSON. Aumentar o limite pode reduzir rejeições e aumentar
a espera; isso exige outra rodada de medição. Não descartamos erros do throughput.
Não há medição de uso de CPU/RAM, rede entre hosts ou comportamento prolongado.

## Evidências e reprodução

- benchmarks/resultados/cpu.csv: todas as repetições e hashes.
- benchmarks/resultados/cpu.json: ambiente, medianas e amplitudes.
- benchmarks/resultados/http.json: resumo e cada latência/status HTTP.
- docs/execucao-u2.md: comandos para reproduzir e roteiro de demonstração.
- docs/arquitetura-u2.md: separação, contrato, limites e diagrama.

Os valores deste relatório vêm desses arquivos. Ao reproduzir, o script sobrescreve
as amostras do mesmo diretório; use --output no benchmark CPU para preservar a rodada original.
Os três critérios da U2 são cobertos por implementação + evidências. Checkout e
fila durável da Parte 1 permanecem fora desta entrega e devem ser tratados pela equipe.
