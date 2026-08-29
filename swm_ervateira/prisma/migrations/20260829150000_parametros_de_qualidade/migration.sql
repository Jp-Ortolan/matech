-- Os limites de qualidade saem do codigo e viram parametro da ervateira.
--
-- POR QUE: o limite de palito e o desconto por ponto estavam escritos em
-- cargas.service.js como constantes, com um comentario dizendo que eram
-- provisorios. So que eles nunca serao definitivos: sao regra comercial, e
-- mudam de ervateira para ervateira e de safra para safra. Deixa-los no codigo
-- obrigaria a alterar o programa para trocar um numero que o comprador negocia.
--
-- LINHA UNICA, id fixo 'padrao': cada instalacao atende uma ervateira, e o id
-- fixo torna leitura e gravacao um upsert simples.

CREATE TABLE "parametros_qualidade" (
    "id"               TEXT NOT NULL DEFAULT 'padrao',
    "limitePalito"     DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    "descontoPorPonto" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "palitoMaximo"     DECIMAL(5,2),
    "umidadeMaxima"    DECIMAL(5,2),
    "folhaMinima"      DECIMAL(5,2),
    "atualizadoEm"     TIMESTAMP(3) NOT NULL,
    "usuarioId"        TEXT,

    CONSTRAINT "parametros_qualidade_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "parametros_qualidade"
  ADD CONSTRAINT "parametros_qualidade_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A linha nasce com os valores que estavam no codigo, para que nada mude de
-- comportamento no momento da migracao. Os tres limites de reprovacao nascem
-- NULOS: nulo quer dizer "nao reprovamos por isso", que e o estado de hoje.
INSERT INTO "parametros_qualidade" ("id", "limitePalito", "descontoPorPonto", "atualizadoEm")
VALUES ('padrao', 30.00, 1.00, NOW())
ON CONFLICT ("id") DO NOTHING;

-- A analise passa a guardar os limites que valiam no dia dela.
--
-- Sem isto, mudar o limite no ano que vem faria um laudo antigo passar a
-- acusar reprovacao por um numero que nao existia quando a amostra foi medida.
ALTER TABLE "analises_qualidade" ADD COLUMN "palitoMaximo"     DECIMAL(5,2);
ALTER TABLE "analises_qualidade" ADD COLUMN "umidadeMaxima"    DECIMAL(5,2);
ALTER TABLE "analises_qualidade" ADD COLUMN "folhaMinima"      DECIMAL(5,2);
ALTER TABLE "analises_qualidade" ADD COLUMN "motivoReprovacao" TEXT;
