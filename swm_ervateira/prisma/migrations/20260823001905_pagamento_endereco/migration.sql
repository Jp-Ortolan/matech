-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('CORRENTE', 'POUPANCA');

-- AlterEnum
ALTER TYPE "FormaPagamento" ADD VALUE 'DINHEIRO';

-- AlterTable
ALTER TABLE "produtores" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" CHAR(8),
ADD COLUMN     "tipoConta" "TipoConta";
