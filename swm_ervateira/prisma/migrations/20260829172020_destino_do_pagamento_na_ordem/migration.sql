-- AlterTable
ALTER TABLE "ordens_pagamento" ADD COLUMN     "agenciaSnapshot" TEXT,
ADD COLUMN     "bancoSnapshot" TEXT,
ADD COLUMN     "contaSnapshot" TEXT,
ADD COLUMN     "formaPagamentoSnapshot" "FormaPagamento",
ADD COLUMN     "tipoChavePixSnapshot" "TipoChavePix",
ADD COLUMN     "tipoContaSnapshot" "TipoConta",
ADD COLUMN     "titularSnapshot" TEXT;
