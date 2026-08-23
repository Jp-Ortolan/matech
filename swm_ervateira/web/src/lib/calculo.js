// ---------------------------------------------------------------------------
// CÁLCULO DE PAGAMENTO · espelho do servidor, só para pré-visualização
// ---------------------------------------------------------------------------
// POR QUE ISTO EXISTE E POR QUE ESTÁ DUPLICADO:
//
// A conta oficial vive no back-end, em src/modules/cargas/cargas.service.js.
// É ela que vale, é ela que grava no banco e é ela que tem teste unitário.
//
// Esta cópia serve a um propósito diferente: dar resposta IMEDIATA enquanto o
// analista digita o percentual de palito. Sem ela, ele digitaria "34", clicaria
// em salvar e só então descobriria o desconto — o que é ruim justamente no
// momento em que ele precisa decidir se aceita a carga.
//
// A duplicação é consciente e delimitada:
//   · o servidor NUNCA confia neste número; ele recalcula do zero ao gravar
//   · a resposta da API traz o cálculo dela, e a tela passa a exibir aquele
//   · se os dois divergirem, o que vale é o do servidor
//
// A alternativa seria pedir o cálculo à API a cada tecla digitada. Foi
// descartada porque geraria dezenas de requisições por análise, com atraso
// perceptível, para uma conta que é uma multiplicação.

export const LIMITE_PALITO_PADRAO = 30
export const DESCONTO_POR_PONTO = 1

export function calcularPagamento({
  pesoLiquidoKg,
  precoBaseKg,
  palitoPercentual = null,
  limitePalito = LIMITE_PALITO_PADRAO,
  descontoPorPonto = DESCONTO_POR_PONTO,
}) {
  const peso = Number(pesoLiquidoKg) || 0
  const precoBase = Number(precoBaseKg) || 0
  const palito = palitoPercentual === '' || palitoPercentual === null ? null : Number(palitoPercentual)

  // Sem análise ainda, não há desconto a aplicar.
  const excedente = palito === null ? 0 : Math.max(0, palito - Number(limitePalito))
  const descontoPercentual = Number((excedente * Number(descontoPorPonto)).toFixed(4))
  const precoAjustadoKg = Number((precoBase * (1 - descontoPercentual / 100)).toFixed(4))
  const valorTotal = Number((peso * precoAjustadoKg).toFixed(2))

  return {
    excedentePalito: Number(excedente.toFixed(2)),
    descontoPercentual,
    precoAjustadoKg,
    valorTotal,
  }
}
