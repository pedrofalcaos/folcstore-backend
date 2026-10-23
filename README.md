# FolcStore Backend

Primeira entrega do backend, pensada para estudar e evoluir em pequenas etapas.
Usa **Node.js + TypeScript + Express 5 + Prisma + SQLite + JWT**.
SQLite é um banco relacional em arquivo: você não precisa instalar PostgreSQL para começar.
O Prisma está na versão 6.19.3; o lockfile fixa as versões usadas nesta entrega.
Os overrides de `deepmerge-ts` e `effect` atualizam dependências transitivas do
Prisma para versões corrigidas. Geração do cliente, migrations e testes foram
validados com essas versões.

## Histórias desta entrega

| História | Situação |
| --- | --- |
| US01 — estrutura, banco e seed | Implementada; usuários, categorias, produtos, pedidos e itens modelados |
| US02 — cadastro, login e perfis | Implementada; JWT de 1 hora, hash bcrypt e proteção por perfil |
| US03 — catálogo e gestão | Núcleo implementado: filtros, paginação, detalhe, criação, atualização e exclusão lógica |
| US03 — complemento: pedidos recebidos pelo artesão | Pendente; depende da US04 |
| US04 — carrinho e pedidos | Pendente; há apenas as tabelas iniciais de pedidos |
| US05 — integração BentoML | Pendente |
| US06 — Redis e filas | Pendente |
| US07 — cache, Swagger e indicadores administrativos | Pendente; README e variáveis já preparados |

O cadastro público permite COMPRADOR e ARTESAO. ADMIN é criado pelo seed local;
não há ainda painel nem endpoints de indicadores. O middleware permite restringir novas rotas por qualquer um dos três perfis.

## Como executar no PowerShell

Pré-requisito: Node.js 22.12 ou superior (preferencialmente uma versão LTS).

```powershell
cd "C:\Users\Pedro Falcão\Desktop\Projeto 4\folcstore-backend"
npm ci
Copy-Item .env.example .env
```

Gere a chave do JWT:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Abra `.env` e preencha `JWT_SECRET` com a chave gerada e `SEED_PASSWORD` com uma
senha de teste de pelo menos 8 caracteres. Não publique esse arquivo.
Depois execute:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse http://localhost:3003/api/health. O resultado deve ser
`{"status":"ok","banco":"conectado"}`.
O servidor local escuta apenas em `127.0.0.1`. Pare com Ctrl+C.

Nas próximas vezes basta `npm run dev`. O banco fica em `prisma/dev.db` e persiste
entre execuções. Não copie `.env.example` sobre um `.env` já configurado.
O seed pode ser repetido: não duplica registros nem apaga alterações existentes.
Mudar `SEED_PASSWORD` não troca a senha de contas já criadas.

Contas fictícias do seed, todas com a senha definida no seu `.env`:

| E-mail | Perfil |
| --- | --- |
| artesao@example.com | ARTESAO |
| comprador@example.com | COMPRADOR |
| admin@example.com | ADMIN |

Para visualizar os registros: `npm run db:studio`.

## Arquitetura simples

```text
Requisição HTTP
    -> routes (URL, autenticação e perfil)
    -> controllers (validação da entrada e resposta HTTP)
    -> services (regras de negócio)
    -> repositories (consultas Prisma)
    -> SQLite
```

```text
prisma/
  schema.prisma       tabelas e relacionamentos
  migrations/         histórico de criação do banco
  seed.ts             dados fictícios para começar
src/
  config/             variáveis de ambiente e conexão Prisma
  routes/             endpoints
  controllers/        entrada e saída HTTP
  services/           regras de autenticação e produtos
  repositories/       acesso ao banco
  middlewares/        autenticação, autorização e erros
  validators/         validação com Zod
  errors/             erro com status HTTP
  app.ts              configura Express
  server.ts           conecta ao banco e inicia a porta
tests/
  api.test.ts         testes HTTP com banco temporário separado
scripts/
  migrate.ts          prepara o arquivo SQLite e aplica migrations
```

Exemplo: para mudar a regra de estoque de uma peça única, veja
`src/validators/produto.schema.ts`. Para entender a regra de propriedade do catálogo,
veja `src/services/produto.service.ts`.

O preço é um inteiro em centavos (`8990` = R$ 89,90), evitando erros de arredondamento.
Um produto pertence a uma categoria e a um artesão. Um pedido pertence a um comprador
e possui itens com quantidade e preço registrado no momento da compra (fluxo futuro).
Peças UNICO aceitam estoque 0 ou 1; LOTE aceita estoque não negativo.
DELETE marca o produto como inativo e o oculta da consulta pública.

## Endpoints implementados

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | /api/health | Público; verifica conexão ao banco |
| POST | /api/auth/register | Público; nome, email, senha, perfil opcional |
| POST | /api/auth/login | Público; email e senha |
| GET | /api/auth/me | Qualquer usuário com JWT |
| GET | /api/categorias | Público |
| GET | /api/produtos | Público; lista paginada |
| GET | /api/produtos/:id | Público; somente produto ativo |
| POST | /api/produtos | ARTESAO |
| PUT | /api/produtos/:id | ARTESAO dono do produto; corpo completo |
| DELETE | /api/produtos/:id | ARTESAO dono do produto |

Filtros de GET `/api/produtos`: `busca` (título/descrição), `categoriaId`, `tecnica`,
`regiao`, `idArtesao`, `pagina` (padrão 1) e `limite` (padrão 12, máximo 50).
Os filtros se combinam. Busca usa `contains` do SQLite; não há normalização de acentos.
Resposta: `{ dados: [...], pagina, limite, total, totalPaginas }`.

Respostas de erro usam `{ erro: "mensagem" }`, com `detalhes` quando há erro de validação.
Status: 400 entrada inválida; 401 token/login inválido; 403 perfil ou dono incorreto;
404 recurso ausente; 409 duplicidade; 429 muitas tentativas de autenticação.
Cadastro e login compartilham um limite de 30 tentativas por IP a cada 15 minutos,
armazenado em memória nesta versão local.

## Teste manual completo

Com o servidor aberto, use outro PowerShell. Informe a senha local quando solicitado:

```powershell
$base = 'http://localhost:3003/api'
$senhaLocal = Read-Host 'Senha do artesão definida em SEED_PASSWORD'
$login = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{
  email = 'artesao@example.com'
  senha = $senhaLocal
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod "$base/auth/me" -Headers $headers

$categorias = Invoke-RestMethod "$base/categorias"
$dados = @{
  titulo = 'Vaso de teste'
  descricao = 'Vaso feito manualmente para testar a API.'
  tecnica = 'Barro'
  regiaoProducao = 'Olinda'
  categoriaId = $categorias[0].id
  precoCentavos = 8990
  quantidadeEstoque = 1
  tipo = 'UNICO'
}
$produto = Invoke-RestMethod "$base/produtos" -Method Post -Headers $headers -ContentType 'application/json' -Body ($dados | ConvertTo-Json)
Invoke-RestMethod "$base/produtos?busca=Vaso&regiao=Olinda" | ConvertTo-Json -Depth 6

$dados.precoCentavos = 9500
Invoke-RestMethod "$base/produtos/$($produto.id)" -Method Put -Headers $headers -ContentType 'application/json' -Body ($dados | ConvertTo-Json)
Invoke-RestMethod "$base/produtos/$($produto.id)" -Method Delete -Headers $headers
```

O exemplo cria, consulta, atualiza e desativa apenas o produto de teste criado nele.

## Validação automatizada

```powershell
npm run build
npm test
```

Os testes aplicam as migrations em um banco temporário e removem apenas esse banco
ao terminar. Cobrem autenticação, senha com hash, perfis, propriedade do catálogo,
validação de estoque/preço, busca, filtros, paginação e exclusão lógica.
Para executar a versão compilada: `npm start` depois de `npm run build`.

## Relação com o frontend e o BentoML

| Serviço | Porta local |
| --- | --- |
| Frontend Next.js | 3000 |
| json-server atual do frontend | 3001 |
| Recomendador BentoML | 3002 |
| Este backend Express | 3003 |

Esta entrega **ainda não substitui o json-server no frontend**. O frontend atual
usa `/products`, preços em reais e login simulado por consulta de e-mail/senha.
Este backend usa `/api/produtos`, preços em centavos, paginação e login POST com JWT.
Trocar somente a variável de URL não basta: os services e os tipos do frontend
precisarão ser adaptados. As demais rotas de pedidos e endereços ainda não existem aqui.
O BentoML também não está conectado nesta entrega; seus IDs de demonstração precisam
ser alinhados aos produtos do banco na US05.

## Próximas pequenas entregas

1. Adaptar login e catálogo do frontend ao contrato desta API.
2. US04: carrinho persistido, criação de pedido e baixa de estoque em transação.
3. Complemento US03: listar pedidos recebidos por artesão.
4. US05: integrar BentoML e definir correspondência de IDs e fallback.
5. US06: Redis/BullMQ e job de confirmação de pedido.
6. US07: Swagger, cache com invalidação e indicadores administrativos.

PostgreSQL pode ser adotado quando a equipe precisar de um servidor compartilhado:
essa mudança exige ajustar o provider, URL e migrations; não basta trocar a URL.
Este projeto é uma base local de aprendizado. Deploy, recuperação de senha,
refresh/revogação de tokens e operação com múltiplas instâncias ainda não estão implementados.
