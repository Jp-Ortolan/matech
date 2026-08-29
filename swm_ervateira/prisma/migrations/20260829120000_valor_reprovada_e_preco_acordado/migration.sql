-- Correções de dado das duas regras ajustadas nesta etapa.
--
-- Nenhuma coluna muda. O que muda são linhas que foram gravadas antes das
-- regras existirem, e que continuariam produzindo números errados nos
-- relatórios para sempre.

-- 1 · CARGA REPROVADA NÃO TEM VALOR
--
-- A análise gravava preço ajustado e valor mesmo quando reprovava a carga,
-- porque o cálculo acontecia antes de olhar para o campo "aprovada". Carga
-- reprovada não entra em ordem de pagamento, então esse dinheiro nunca
-- existiu — mas era somado em "valor apurado", nos agrupamentos por produtor
-- e nos totais por matéria-prima.
--
-- O desconto percentual permanece: ele é medida de laboratório e vale
-- independentemente do destino da carga.
UPDATE "analises_qualidade"
   SET "precoAjustadoKg" = NULL,
       "valorTotal"      = NULL
 WHERE "aprovada" = false;

-- 2 · O PREÇO ACORDADO NA ORDEM PASSA A SER O PREÇO DA CARGA
--
-- Depois que o preço saiu da balança, as cargas antigas continuaram com o
-- precoBaseKg digitado na pesagem, enquanto a emissão da ordem gravava o
-- preço acordado apenas no lado ajustado. Os dois preços conviviam, cada um
-- de um momento, e as telas liam a diferença entre eles como se fosse
-- desconto de qualidade.
--
-- Aqui o preço acordado é reconstruído a partir do item da ordem, desfazendo
-- o desconto que foi aplicado sobre ele: se o item foi pago a R$ 4,80 com 4%
-- de desconto, o preço acordado era R$ 5,00.
UPDATE "cargas" c
   SET "precoBaseKg" = ROUND(i."precoKg" / (1 - a."descontoPercentual" / 100), 4)
  FROM "itens_ordem_pagamento" i
  JOIN "analises_qualidade" a ON a."cargaId" = i."cargaId"
 WHERE i."cargaId" = c."id"
   AND a."descontoPercentual" < 100;
