-- Remoção da régua de qualidade.
--
-- Sai o desconto por palito e saem os limites de reprovação. O laboratório
-- continua medindo palito, umidade e folha; quem reprova é o analista, e o
-- motivo escrito passa a ser a única explicação da reprovação.
--
-- ATENÇÃO: esta migração APAGA dado. As colunas removidas de
-- "analises_qualidade" guardavam os limites que valiam no dia de cada análise
-- e o desconto que ela gerou. As análises já gravadas perdem essa parte do
-- laudo, e não há como reconstruí-la depois.

-- DropForeignKey
ALTER TABLE "parametros_qualidade" DROP CONSTRAINT IF EXISTS "parametros_qualidade_usuarioId_fkey";

-- DropTable
DROP TABLE IF EXISTS "parametros_qualidade";

-- AlterTable
ALTER TABLE "analises_qualidade" DROP COLUMN "limitePalito",
DROP COLUMN "descontoPercentual",
DROP COLUMN "palitoMaximo",
DROP COLUMN "umidadeMaxima",
DROP COLUMN "folhaMinima";
