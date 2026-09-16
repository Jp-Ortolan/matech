-- Pesagem em duas idas à balança.
--
-- Entrada: o caminhão sobe cheio, grava-se o peso bruto e a carga fica em
-- AGUARDANDO_TARA. Saída: o caminhão volta vazio, a tara é pesada, o peso
-- líquido fecha e o ticket é emitido.
--
-- Por isso "taraKg" e "pesoLiquidoKg" passam a aceitar nulo: entre uma pesagem
-- e a outra eles não existem. As cargas já gravadas têm os dois preenchidos e
-- não mudam de situação.
--
-- Junto vem "metragemM3", a metragem da lenha. É registro de conferência do
-- pátio e não entra em cálculo nenhum: lenha continua sendo paga por quilo.

-- AlterEnum
ALTER TYPE "SituacaoCarga" ADD VALUE IF NOT EXISTS 'AGUARDANDO_TARA' BEFORE 'AGUARDANDO_ANALISE';

-- AlterTable
ALTER TABLE "cargas" ALTER COLUMN "taraKg" DROP NOT NULL,
ALTER COLUMN "pesoLiquidoKg" DROP NOT NULL,
ADD COLUMN "metragemM3" DECIMAL(10,2),
ALTER COLUMN "situacao" SET DEFAULT 'AGUARDANDO_TARA';
