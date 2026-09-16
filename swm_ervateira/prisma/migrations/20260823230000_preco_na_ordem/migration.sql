-- O preço sai da balança e passa a ser definido na emissão da ordem.
--
-- POR QUÊ: quem digitava o preço era o operador de balança, no momento da
-- pesagem — mas quem acorda o valor com o produtor é o administrativo, e isso
-- acontece depois, quando a carga já foi analisada. Pedir o preço na balança
-- obrigava o operador a saber uma informação comercial que não é dele.
--
-- O QUE MUDA: três colunas deixam de ser obrigatórias. Nenhuma linha existente
-- é alterada — as cargas já pesadas continuam com o preço que tinham, e as
-- análises já lançadas continuam com o valor que calcularam.
--
-- A análise passa a registrar apenas o DESCONTO PERCENTUAL, que é medida de
-- qualidade e não depende de preço. O preço ajustado e o valor total são
-- gravados de volta pela emissão da ordem, dentro da mesma transação.

ALTER TABLE "cargas"            ALTER COLUMN "precoBaseKg"     DROP NOT NULL;
ALTER TABLE "analises_qualidade" ALTER COLUMN "precoAjustadoKg" DROP NOT NULL;
ALTER TABLE "analises_qualidade" ALTER COLUMN "valorTotal"      DROP NOT NULL;
