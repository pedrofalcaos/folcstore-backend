# Revisão e simplificação

## Mudanças aplicadas

- Frontend: a rota antiga `/customer/pagamento` redireciona ao checkout principal.
  Foi removido um segundo fluxo de criação de pedidos sem baixa de estoque e o
  alias `CompraProduto = any` utilizado exclusivamente por esse fluxo.
- Frontend: recomendações passam a filtrar disponibilidade em todos os caminhos,
  inclusive produtos relacionados e mais vendidos. IDs disponíveis são indexados
  com Set, evitando uma busca linear no catálogo para cada produto vendido.
- Frontend: a home consulta os pedidos uma vez e deriva o histórico do comprador
  dessa resposta. Antes fazia duas chamadas contendo dados sobrepostos. A montagem
  dos cards agora preserva a ordem dos IDs recomendados com Map.
- Python U2: candidatos são produzidos sob demanda e `heapq.nsmallest` seleciona
  os k melhores, em vez de guardar e ordenar todos os candidatos. A seleção muda
  de O(N log N) para O(N log k), com memória adicional de seleção O(k). O catálogo
  e a saída do lote continuam ocupando memória própria. O cálculo de similaridade
  entre descrições permanece o custo dominante e continua sendo executado.
- Python U2: índice de produtos é construído uma vez por chamada sequencial ou
  paralela. Cada origem deixa de exigir uma nova busca linear por ID no catálogo.

O ranking, pesos, arredondamento e desempate por ID foram preservados. Testes
comparam top-k e ordenação completa, além da igualdade sequencial/paralela.
Não se afirma ganho percentual de tempo sem uma nova rodada de benchmark.

## Pendências que exigem implementação de funcionalidade

Atualização da etapa de compra local: os itens 1 e 2 abaixo foram resolvidos para
cadastro/login e compra com Express. Carrinho persistido, transação, idempotência
e integração estão descritos em `compra-local.md`. O texto abaixo registra o
diagnóstico histórico que motivou essa implementação.

1. O checkout principal ainda cria pedidos e baixa estoque em requisições separadas
   ao json-server. Transação no backend, validação de preço/estoque e idempotência
   são necessárias para impedir vendas simultâneas da última unidade e duplicação
   ao repetir uma compra após falha parcial. Remover a rota antiga não resolve isso.
2. O login do frontend ainda é uma simulação com json-server e precisa migrar para
   os endpoints JWT do Express antes de uso real.
3. O recomendador BentoML original continua com endpoints de demonstração/mock.
   Ele não é o serviço Python da U2; remover mocks agora alteraria o escopo daquele
   projeto. Não foram apagados exemplos ou variantes didáticas sem evidência de
   que estejam obsoletos para a equipe.

## Evidências de desempenho anteriores

Os números em `desempenho-u2.md` e `benchmarks/resultados/` foram medidos na entrega
`f8a32bc`, antes destas otimizações. São uma linha de base histórica e não uma
medição desta revisão. O script de benchmark pode ser executado novamente em um
diretório separado com `--output` para comparar as versões sem perder a evidência.

## Testes

No frontend (Node.js 22.6+ para executar TypeScript nativamente):

```powershell
node --experimental-strip-types --test tests/recommendation.test.mjs
npx tsc --noEmit
```

No backend:

```powershell
npm run build
npm test
python -m unittest discover -s services/recomendador -p test_core.py
```
