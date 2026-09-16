-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "usuarioPerfil" "PerfilUsuario" NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "alvo" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_auditoria_criadoEm_idx" ON "registros_auditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "registros_auditoria_acao_idx" ON "registros_auditoria"("acao");

-- CreateIndex
CREATE INDEX "registros_auditoria_usuarioId_idx" ON "registros_auditoria"("usuarioId");
