-- CreateTable
CREATE TABLE "Endereco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "complemento" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    CONSTRAINT "Endereco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemCarrinho" (
    "compradorId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,

    PRIMARY KEY ("compradorId", "produtoId"),
    CONSTRAINT "ItemCarrinho_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemCarrinho_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ItemPedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitarioCentavos" INTEGER NOT NULL,
    "tituloProduto" TEXT NOT NULL DEFAULT '',
    "idArtesao" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ItemPedido" ("id", "pedidoId", "precoUnitarioCentavos", "produtoId", "quantidade") SELECT "id", "pedidoId", "precoUnitarioCentavos", "produtoId", "quantidade" FROM "ItemPedido";
DROP TABLE "ItemPedido";
ALTER TABLE "new_ItemPedido" RENAME TO "ItemPedido";
CREATE TABLE "new_Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compradorId" TEXT NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chaveIdempotencia" TEXT,
    "solicitacaoHash" TEXT,
    "enderecoEntrega" JSONB NOT NULL DEFAULT '{}',
    "metodoPagamento" TEXT NOT NULL DEFAULT 'PIX',
    CONSTRAINT "Pedido_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("compradorId", "criadoEm", "id", "status", "totalCentavos") SELECT "compradorId", "criadoEm", "id", "status", "totalCentavos" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
CREATE INDEX "Pedido_compradorId_criadoEm_idx" ON "Pedido"("compradorId", "criadoEm");
CREATE UNIQUE INDEX "Pedido_compradorId_chaveIdempotencia_key" ON "Pedido"("compradorId", "chaveIdempotencia");
CREATE TABLE "new_Produto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tecnica" TEXT NOT NULL,
    "regiaoProducao" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "quantidadeEstoque" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'LOTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "idArtesao" TEXT NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "materiaPrima" TEXT NOT NULL DEFAULT '',
    "guiaCuidados" TEXT NOT NULL DEFAULT '',
    "prazoProducao" INTEGER NOT NULL DEFAULT 0,
    "dimensoes" JSONB NOT NULL DEFAULT '{}',
    "galeriaImagens" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Produto_idArtesao_fkey" FOREIGN KEY ("idArtesao") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Produto" ("ativo", "atualizadoEm", "categoriaId", "criadoEm", "descricao", "id", "idArtesao", "precoCentavos", "quantidadeEstoque", "regiaoProducao", "tecnica", "tipo", "titulo") SELECT "ativo", "atualizadoEm", "categoriaId", "criadoEm", "descricao", "id", "idArtesao", "precoCentavos", "quantidadeEstoque", "regiaoProducao", "tecnica", "tipo", "titulo" FROM "Produto";
DROP TABLE "Produto";
ALTER TABLE "new_Produto" RENAME TO "Produto";
CREATE INDEX "Produto_idArtesao_idx" ON "Produto"("idArtesao");
CREATE INDEX "Produto_categoriaId_ativo_idx" ON "Produto"("categoriaId", "ativo");
CREATE TABLE "new_Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'COMPRADOR',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpf" TEXT,
    "telefone" TEXT NOT NULL DEFAULT '',
    "versaoCarrinho" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Usuario" ("criadoEm", "email", "id", "nome", "perfil", "senhaHash") SELECT "criadoEm", "email", "id", "nome", "perfil", "senhaHash" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Endereco_usuarioId_idx" ON "Endereco"("usuarioId");
