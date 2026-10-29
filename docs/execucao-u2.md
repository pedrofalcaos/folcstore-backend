# Unidade 2 — execução e apresentação

Requisitos: Node.js >=22.12, Python >=3.11, dependências npm e banco configurados
conforme o README. Python não precisa de pip nem de dependências externas.
Os arquivos estão dentro do próprio repositório do backend.

## Dois terminais

Em ambos, entre na pasta do backend:

```powershell
cd "C:\Users\Pedro Falcão\Desktop\Projeto 4\folcstore-backend"
```

Terminal 1, serviço de recomendações (deixe aberto):

```powershell
npm run recommender
```

Terminal 2, Express (deixe aberto):

```powershell
npm run dev
```

Abra http://localhost:3003/demonstracao, selecione uma peça e clique em **Ver sugestões**.
O navegador consulta Express, que consulta Python por HTTP e retorna produtos do banco.
Saúde: http://localhost:3003/api/health e http://127.0.0.1:3004/health.
O frontend Next.js pode continuar na porta 3000, mas sua integração completa permanece
uma entrega separada. A página desta U2 demonstra a comunicação já implementada.

## Gerar recomendações em lote

Em um terceiro PowerShell, faça login de artesão com sua senha do seed:

```powershell
$senhaLocal = Read-Host 'Senha local do artesão'
$login = Invoke-RestMethod http://localhost:3003/api/auth/login -Method Post -ContentType 'application/json' -Body (@{
  email = 'artesao@example.com'; senha = $senhaLocal
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
$resultado = Invoke-RestMethod http://localhost:3003/api/recomendacoes/lote -Method Post -Headers $headers -ContentType 'application/json' -Body '{"modo":"paralelo","limite":4}'
$resultado | ConvertTo-Json -Depth 8
```

Troque o modo por `sequencial` para executar o mesmo ranking sem distribuir o lote.
O catálogo de seed tem apenas três peças: ele serve para validar integração, não para
comprovar ganho de CPU. Os testes de escala usam massa sintética isolada.
Para lotes maiores, configure `RECOMMENDER_TIMEOUT_MS=120000` no `.env` e reinicie
Express. O timeout é limite de espera HTTP, não acelera nem cancela um cálculo.

## Reproduzir medições

CPU (não precisa dos servidores; aguarde terminar antes de medir HTTP):

```powershell
npm run benchmark:cpu -- --sizes 16 128 384 --workers 4 --repetitions 5
```

O lote maior pode levar vários minutos. Não há `sleep` nem carga artificial repetida
no algoritmo: cada produto é comparado aos outros para gerar seu ranking.
Para uma apresentação rápida, use `--sizes 16 128 --workers 4 --repetitions 3`.

HTTP (com os dois servidores ativos e sem benchmark CPU simultâneo):

```powershell
npm run benchmark:http
```

O teste HTTP pressupõe os produtos do seed e cota de recomendações disponível.
Se repetir em menos de um minuto, pode atingir o rate limit de 60 requisições/minuto
e registrar 429. Espere a janela expirar ou reinicie o Express local de teste.
Os erros ficam nas amostras e fazem o script encerrar com falha; não são descartados.

Para atualizar o relatório a partir das novas amostras:

```powershell
python benchmarks/relatorio.py
```

## Verificações

```powershell
npm run build
npm test
python -m unittest discover -s services/recomendador -p test_core.py
```

`npm test` exige Python no PATH e inicia seu próprio recomendador em uma porta
temporária. Para outro executável, defina `$env:PYTHON` com o caminho antes do teste.
Os testes usam um banco temporário, sem modificar o banco local.

## Roteiro para a banca

1. Mostrar `arquitetura-u2.md` e justificar os dois serviços.
2. Abrir a demonstração e a aba Network do navegador; mostrar a chamada à API.
3. Executar o lote de artesão em ambos os modos e mostrar resultados equivalentes.
4. Mostrar o script CPU, CSV, hashes e o relatório com cinco repetições.
5. Explicar custo de inicialização, transferência entre processos e ganho em lotes.
6. Mostrar o benchmark HTTP, incluindo p95, throughput e eventuais erros.
7. Parar Python e pedir sugestões: deve retornar indisponibilidade, enquanto
   `/api/produtos` continua funcionando. Reiniciar Python para restaurar a demonstração.

Não apresentar checkout/filas da Parte 1 como implementados neste repositório.
Esta entrega cobre o recorte FCCPD da Unidade 2 descrito no enunciado.
