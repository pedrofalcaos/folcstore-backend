# Deploy do Origem (PI4-205)

## Backend no Render

Crie um Web Service gratuito a partir do repositório do backend, na branch main.

- **Build Command:** `npm ci --include=dev && npm run build:render`
- **Start Command:** `npm run start:render`
- **Health Check Path:** `/api/health`

O build gera o cliente Prisma para PostgreSQL. A inicialização aplica as migrações usando a conexão direta do Neon antes de iniciar o Express.

| Variável no Render | Valor |
| --- | --- |
| `NODE_VERSION` | `22.22.0` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | URL com pool do Neon |
| `DATABASE_URL_UNPOOLED` | URL direta do Neon |
| `JWT_SECRET` | Chave exclusiva com pelo menos 32 caracteres |
| `FRONTEND_URL` | `https://folcstore-frontend.vercel.app` |
| `RECOMMENDER_URL` | URL do recomendador Python, se publicado |

As duas URLs do Neon estão no arquivo local ignorado pelo Git `.env.neon`. Cadastre as variáveis privadas no painel do Render. O Render fornece `PORT`. Use uma chave aleatória para JWT, por exemplo com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

A primeira migração cria as tabelas e as categorias Cerâmica e Madeira. Cadastre uma conta de artesão pelo site e crie um produto de demonstração. O banco publicado começa sem os registros do SQLite local.

Para mudanças futuras no modelo, atualize os dois schemas Prisma e versione uma migração para cada banco. O desenvolvimento local continua usando `prisma/schema.prisma` e os comandos `db:generate` e `db:migrate`.

## Frontend no Vercel

1. Verifique que a URL pública do Render termina em `/api/health` ao acessar a rota e retorna banco conectado.
2. Nas variáveis do Vercel para **Production**, defina `NEXT_PUBLIC_BACKEND_URL` com a URL pública do Render terminada em `/api`. Faça um novo deploy para incluir o valor no build.
3. Abra o frontend publicado, confira o catálogo e faça uma compra simulada com uma conta de teste.
4. Após reiniciar a API, consulte o histórico para confirmar a persistência do pedido.

O painel administrativo e as avaliações ainda têm chamadas à API legada, configurada por `NEXT_PUBLIC_API_URL`. A validação acima cobre o fluxo de cliente pelo backend Express.
