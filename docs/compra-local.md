# Compra completa local — PI4-187 / PI4-188 / PI4-189 / PI4-190

## O que foi entregue

Carrinho de comprador autenticado salvo no SQLite, endereços persistidos, criação
de pedido com total calculado no servidor e baixa de estoque na mesma transação.
O frontend Next.js usa o Express para login/cadastro JWT, catálogo, carrinho,
endereços, checkout e histórico de pedidos. O fluxo não depende do json-server
nem do recomendador para concluir uma compra.

O registro de pedido é uma simulação de compra: nenhum Pix ou cartão é cobrado.
O frontend não solicita dados reais de cartão e o status do pedido é CONFIRMADO.
Gateway real, estorno, fila durável de notificações, envio/rastreio, avaliações,
alteração cadastral e troca de senha continuam fora desta etapa. Os botões legados
de fulfillment não escrevem pedidos no banco antigo: informam indisponibilidade.

## Executar nesta máquina

Em um PowerShell, inicie o backend:

```powershell
cd "C:\Users\Pedro Falcão\Desktop\Projeto 4\folcstore-backend"
npm run db:generate
npm run db:migrate
npm run dev
```

O `.env` local já foi configurado. Em uma instalação nova, siga o README para
criar o `.env` e definir JWT_SECRET e SEED_PASSWORD antes destes comandos.
Para dados de demonstração em banco novo, execute `npm run db:seed` antes do dev.
O seed preserva os registros existentes e não restaura estoque de produtos vendidos.

Em outro PowerShell:

```powershell
cd "C:\Users\Pedro Falcão\Desktop\Projeto 4\folcstore-frontend"
npm run dev
```

Abra http://localhost:3000/customer/register e cadastre um comprador, incluindo
endereço. Ou entre com uma conta já criada no Express. Contas antigas do
json-server e carrinhos do LocalStorage antigo não são importados automaticamente.
As sessões anteriores precisam fazer login novamente para receber JWT.

1. Abra o catálogo em `/customer` ou `/`.
2. Adicione produtos; é necessário entrar como comprador.
3. Abra o carrinho, confira quantidades e vá para **Finalizar Compra**.
4. Selecione o endereço e a forma de pagamento de demonstração.
5. Confirme. A tela mostra o número do pedido e o total efetivamente registrado.
6. Abra **Ver meus pedidos** para consultar o histórico do banco.

Recarregar a página ou sair e entrar novamente recupera o carrinho do comprador.
O carrinho é limpo após uma compra confirmada, mas pedidos ficam no histórico.

## Endpoints e proteção

Todas as rotas abaixo exigem `Authorization: Bearer TOKEN` de COMPRADOR.

| Método | Endpoint | Resultado |
| --- | --- | --- |
| GET | /api/carrinho | Itens, versão, subtotais e total atuais |
| PUT | /api/carrinho/itens/:produtoId | Define a quantidade absoluta; corpo `{"quantidade":2}` |
| DELETE | /api/carrinho/itens/:produtoId | Remove um produto |
| DELETE | /api/carrinho | Esvazia o carrinho |
| GET | /api/enderecos | Lista os endereços do usuário |
| POST | /api/enderecos | Adiciona endereço |
| DELETE | /api/enderecos/:id | Remove endereço do próprio usuário |
| POST | /api/pedidos | Confirma o carrinho em transação |
| GET | /api/pedidos | Últimos 100 pedidos do próprio comprador |

Também existem consultas protegidas `/api/artesao/pedidos` e `/api/admin/pedidos`
para os respectivos perfis e consulta pública de nomes em `/api/artesaos`.
Documentação interativa Swagger continua sendo uma próxima entrega.

POST `/api/pedidos` exige o cabeçalho `Idempotency-Key` com UUID e este corpo:

```json
{
  "enderecoId": "UUID-do-endereco-do-comprador",
  "metodoPagamento": "PIX",
  "versaoCarrinho": 3,
  "totalEsperadoCentavos": 2500
}
```

Versão e total vêm do GET do carrinho. Não são aceitos compradorId, preço unitário,
itens ou total definitivo fornecidos pelo navegador. O usuário é identificado pelo
JWT, e produtos/preços/quantidades são lidos do banco. O total esperado serve apenas
para recusar a compra se o preço mudar após a revisão; não determina o valor cobrado.

## Como a consistência é garantida

1. A transação adquire o bloqueio de escrita SQLite antes de ler carrinho e estoque.
2. Procura um pedido do comprador com a mesma chave de idempotência.
3. Se existir e o corpo for igual, devolve o mesmo pedido com HTTP 200.
4. Se a chave for nova, valida versão do carrinho e propriedade do endereço.
5. Calcula o total usando preços do banco e compara com o total esperado.
6. Cada produto é decrementado com condição `ativo = true` e `estoque >= quantidade`.
7. Cria pedido e itens com snapshots de título, preço unitário e endereço.
8. Limpa o carrinho e incrementa a versão. Tudo é confirmado junto (HTTP 201).

Qualquer falha reverte pedido, estoque e limpeza do carrinho. Não há um mutex só
em memória: a proteção de escrita é do banco. Esta implementação foi feita para
SQLite local; a migração para PostgreSQL precisa rever SQL de bloqueio e migrations.

Adicionar ao carrinho não reserva estoque. Dois compradores podem carregar a
mesma peça, mas apenas o primeiro que conseguir confirmar a unidade disponível
recebe o pedido. O outro recebe HTTP 409 e pode ajustar seu carrinho.

Cada edição de carrinho altera a versão. Uma confirmação de uma aba desatualizada
é recusada. Preço ou estoque alterado entre revisão e confirmação também é tratado.
Há limites de 50 produtos, 99 unidades por item e total até 2147483647 centavos.

O frontend guarda a chave e o corpo de uma tentativa pendente por comprador.
Se a resposta se perder, **Verificar confirmação pendente** repete a mesma tentativa.
O backend devolve o pedido já criado em vez de descontar estoque novamente.
O frontend sincroniza o carrinho após sucesso, sem apagar itens novos adicionados
em outra aba depois da compra.

## Testes e evidências

```powershell
# Backend
npm run build
npm test

# Frontend
npm run test:recommendations
npm run test:e2e
npm run build
```

Os testes de API usam bancos temporários e verificam: persistência/isolamento do
carrinho, restrição por perfil, total do banco, snapshots históricos, corrida pela
última unidade, repetição simultânea da mesma confirmação, rollback do lote,
versão desatualizada, preço modificado, campos adulterados e endereços de terceiros.

O teste Playwright cadastra um comprador pela interface, adiciona duas unidades,
recarrega o checkout, simula uma confirmação cuja resposta foi perdida, recupera
essa confirmação e consulta o histórico. Confere um único pedido e uma única baixa.
Usa Chrome instalado, portas 3100/3103 e um banco temporário, separado do banco local.
Para executar os dois repositórios precisam estar em pastas irmãs como nesta máquina.
Os traces podem conter dados das contas fictícias; `test-results` não é versionado.

## Banco e configuração

A migration `20261102205907_carrinho_pedidos` acrescenta tabelas e campos preservando
os dados anteriores. Os defaults JSON do SQL gerado foram corrigidos para literais
SQLite válidos (`'{}'` e `'[]'`); as migrations são testadas em um banco vazio.
Na máquina de desenvolvimento, a aplicação parcial foi recuperada com backup e
conferência de contagem/relacionamentos, sem reset do banco. Bancos e backups não
entram no Git.

Frontend: `NEXT_PUBLIC_BACKEND_URL=http://localhost:3003/api` (também é o padrão).
Backend: `FRONTEND_URL=http://localhost:3000`, PORT 3003, JWT_SECRET e DATABASE_URL.
Alterar variáveis públicas do Next exige reiniciar o servidor ou refazer o build.

Os scripts antigos `dev:full`/`api` do frontend ainda atendem funcionalidades legadas;
para a compra desta etapa, execute `npm run dev` em cada repositório.

A instalação das ferramentas de teste apontou alertas de auditoria no conjunto de
dependências legadas do frontend. Atualização das dependências e nova avaliação
devem fazer parte da preparação para publicação; não foi aplicado `audit fix --force`
durante esta entrega para evitar mudanças incompatíveis sem validação.
