-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('OPERADOR_BALANCA', 'ANALISTA_QUALIDADE', 'COMPRADOR_AVALIADOR', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "TipoErva" AS ENUM ('PLANTADA', 'NATIVA');

-- CreateEnum
CREATE TYPE "TipoMateriaPrima" AS ENUM ('ERVA_MATE_PLANTADA', 'ERVA_MATE_NATIVA', 'PALITO', 'LENHA');

-- CreateEnum
CREATE TYPE "GrauQueima" AS ENUM ('NAO', 'EM_PARTE', 'SIM');

-- CreateEnum
CREATE TYPE "Classificacao" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'CONTA_BANCARIA');

-- CreateEnum
CREATE TYPE "TipoChavePix" AS ENUM ('CPF', 'TELEFONE', 'EMAIL', 'ALEATORIA');

-- CreateEnum
CREATE TYPE "SituacaoCarga" AS ENUM ('AGUARDANDO_ANALISE', 'ANALISADA', 'EM_ORDEM_PAGAMENTO', 'PAGA', 'REPROVADA');

-- CreateEnum
CREATE TYPE "SituacaoOrdem" AS ENUM ('PENDENTE', 'PAGA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SituacaoSincronizacao" AS ENUM ('PENDENTE', 'ENVIADO', 'ERRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcesso" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "municipio" TEXT,
    "uf" CHAR(2),
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'PIX',
    "tipoChavePix" "TipoChavePix",
    "chavePix" TEXT,
    "titularConta" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "clientId" TEXT,
    "criadoOffline" BOOLEAN NOT NULL DEFAULT false,
    "sincronizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ervais" (
    "id" TEXT NOT NULL,
    "produtorId" TEXT NOT NULL,
    "identificacao" TEXT NOT NULL,
    "tipoErva" "TipoErva" NOT NULL,
    "quantidadeEstimadaKg" DECIMAL(12,2),
    "idadeAnos" INTEGER,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "clientId" TEXT,
    "criadoOffline" BOOLEAN NOT NULL DEFAULT false,
    "sincronizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ervais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT,
    "cnhCategoria" TEXT,
    "cnhValidade" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" TEXT,
    "taraKg" DECIMAL(10,2),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "ervalId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataAvaliacao" TIMESTAMP(3) NOT NULL,
    "tipoErva" "TipoErva" NOT NULL,
    "ervaQueimada" "GrauQueima" NOT NULL DEFAULT 'NAO',
    "idadeErvalAnos" INTEGER,
    "quantidadeEstimadaKg" DECIMAL(12,2),
    "classificacao" "Classificacao",
    "umidadeEstimada" DECIMAL(5,2),
    "taloAparente" TEXT,
    "valorCombinadoKg" DECIMAL(10,4),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "observacoes" TEXT,
    "clientId" TEXT NOT NULL,
    "criadoOffline" BOOLEAN NOT NULL DEFAULT false,
    "alteradoEmOrigem" TIMESTAMP(3) NOT NULL,
    "sincronizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_erval" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanhoBytes" INTEGER,
    "largura" INTEGER,
    "altura" INTEGER,
    "clientId" TEXT NOT NULL,
    "sincronizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_erval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargas" (
    "id" TEXT NOT NULL,
    "numeroTicket" TEXT NOT NULL,
    "produtorId" TEXT NOT NULL,
    "ervalId" TEXT,
    "motoristaId" TEXT,
    "veiculoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "avaliacaoId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoMateriaPrima" "TipoMateriaPrima" NOT NULL,
    "pesoBrutoKg" DECIMAL(12,2) NOT NULL,
    "taraKg" DECIMAL(12,2) NOT NULL,
    "pesoLiquidoKg" DECIMAL(12,2) NOT NULL,
    "pesoEstimadoCampoKg" DECIMAL(12,2),
    "precoBaseKg" DECIMAL(10,4) NOT NULL,
    "situacao" "SituacaoCarga" NOT NULL DEFAULT 'AGUARDANDO_ANALISE',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analises_qualidade" (
    "id" TEXT NOT NULL,
    "cargaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "palitoPercentual" DECIMAL(5,2) NOT NULL,
    "umidadePercentual" DECIMAL(5,2),
    "folhaPercentual" DECIMAL(5,2),
    "observacoes" TEXT,
    "limitePalito" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    "descontoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "precoAjustadoKg" DECIMAL(10,4) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "aprovada" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analises_qualidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_pagamento" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "produtorId" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "situacao" "SituacaoOrdem" NOT NULL DEFAULT 'PENDENTE',
    "chavePixSnapshot" TEXT,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_ordem_pagamento" (
    "id" TEXT NOT NULL,
    "ordemId" TEXT NOT NULL,
    "cargaId" TEXT NOT NULL,
    "pesoLiquidoKg" DECIMAL(12,2) NOT NULL,
    "precoKg" DECIMAL(10,4) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_ordem_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_sincronizacao" (
    "id" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payload" JSONB,
    "situacao" "SituacaoSincronizacao" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erroMensagem" TEXT,
    "houveConflito" BOOLEAN NOT NULL DEFAULT false,
    "versaoVencedora" TEXT,
    "criadoEmOrigem" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEm" TIMESTAMP(3),

    CONSTRAINT "registros_sincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "produtores_cpfCnpj_key" ON "produtores"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "produtores_clientId_key" ON "produtores"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ervais_clientId_key" ON "ervais"("clientId");

-- CreateIndex
CREATE INDEX "ervais_produtorId_idx" ON "ervais"("produtorId");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

-- CreateIndex
CREATE INDEX "veiculos_motoristaId_idx" ON "veiculos"("motoristaId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_clientId_key" ON "avaliacoes"("clientId");

-- CreateIndex
CREATE INDEX "avaliacoes_ervalId_idx" ON "avaliacoes"("ervalId");

-- CreateIndex
CREATE INDEX "avaliacoes_usuarioId_idx" ON "avaliacoes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_erval_clientId_key" ON "fotos_erval"("clientId");

-- CreateIndex
CREATE INDEX "fotos_erval_avaliacaoId_idx" ON "fotos_erval"("avaliacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "cargas_numeroTicket_key" ON "cargas"("numeroTicket");

-- CreateIndex
CREATE INDEX "cargas_produtorId_idx" ON "cargas"("produtorId");

-- CreateIndex
CREATE INDEX "cargas_dataHora_idx" ON "cargas"("dataHora");

-- CreateIndex
CREATE INDEX "cargas_situacao_idx" ON "cargas"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "analises_qualidade_cargaId_key" ON "analises_qualidade"("cargaId");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_pagamento_numero_key" ON "ordens_pagamento"("numero");

-- CreateIndex
CREATE INDEX "ordens_pagamento_produtorId_idx" ON "ordens_pagamento"("produtorId");

-- CreateIndex
CREATE UNIQUE INDEX "itens_ordem_pagamento_cargaId_key" ON "itens_ordem_pagamento"("cargaId");

-- CreateIndex
CREATE INDEX "itens_ordem_pagamento_ordemId_idx" ON "itens_ordem_pagamento"("ordemId");

-- CreateIndex
CREATE UNIQUE INDEX "registros_sincronizacao_clientId_key" ON "registros_sincronizacao"("clientId");

-- CreateIndex
CREATE INDEX "registros_sincronizacao_dispositivoId_idx" ON "registros_sincronizacao"("dispositivoId");

-- CreateIndex
CREATE INDEX "registros_sincronizacao_situacao_idx" ON "registros_sincronizacao"("situacao");

-- AddForeignKey
ALTER TABLE "ervais" ADD CONSTRAINT "ervais_produtorId_fkey" FOREIGN KEY ("produtorId") REFERENCES "produtores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_ervalId_fkey" FOREIGN KEY ("ervalId") REFERENCES "ervais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_erval" ADD CONSTRAINT "fotos_erval_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_produtorId_fkey" FOREIGN KEY ("produtorId") REFERENCES "produtores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_ervalId_fkey" FOREIGN KEY ("ervalId") REFERENCES "ervais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises_qualidade" ADD CONSTRAINT "analises_qualidade_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "cargas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises_qualidade" ADD CONSTRAINT "analises_qualidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_pagamento" ADD CONSTRAINT "ordens_pagamento_produtorId_fkey" FOREIGN KEY ("produtorId") REFERENCES "produtores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_ordem_pagamento" ADD CONSTRAINT "itens_ordem_pagamento_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_ordem_pagamento" ADD CONSTRAINT "itens_ordem_pagamento_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "cargas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
