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

// O que vale enquanto os parâmetros não carregaram, e só isso. A régua de
// verdade vem de GET /api/parametros/qualidade — estes números existem para
// que a tela não pisque com "0%" no primeiro quadro.
export const LIMITE_PALITO_PADRAO = 30
export const DESCONTO_POR_PONTO = 1

/**
 * Espelho de src/modules/qualidade/limites.js, pelo MESMO motivo do cálculo
 * acima: dizer ao analista que a amostra estourou o limite enquanto ele digita,
 * e não depois de gravar.
 *
 * Vale o mesmo aviso: quem decide é o servidor. A resposta de registrarAnalise
 * traz a conferência dele, e é ela que a tela passa a exibir.
 *
 * Limite nulo é ausência de regra, não zero.
 */
export function conferirLimites(medidas, limites) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
  const { palitoMaximo, umidadeMaxima, folhaMinima } = limites ?? {}
  const palito = num(medidas?.palitoPercentual)
  const umidade = num(medidas?.umidadePercentual)
  const folha = num(medidas?.folhaPercentual)
  const motivos = []

  if (palitoMaximo != null && palito != null && palito > Number(palitoMaximo)) {
    motivos.push({ campo: 'palito', texto: `Palito de ${pct(palito)}, acima do máximo de ${pct(palitoMaximo)}.` })
  }
  if (umidadeMaxima != null && umidade != null && umidade > Number(umidadeMaxima)) {
    motivos.push({ campo: 'umidade', texto: `Umidade de ${pct(umidade)}, acima do máximo de ${pct(umidadeMaxima)}.` })
  }
  // Folha é o invertido: quem compra erva-mate compra folha, então menos é pior.
  if (folhaMinima != null && folha != null && folha < Number(folhaMinima)) {
    motivos.push({ campo: 'folha', texto: `Folha de ${pct(folha)}, abaixo do mínimo de ${pct(folhaMinima)}.` })
  }
  return motivos
}

function pct(v) {
  return `${Number(v).toFixed(1).replace('.', ',')}%`
}

export function calcularPagamento({
  pesoLiquidoKg,
  precoBaseKg,
  palitoPercentual = null,
  limitePalito = LIMITE_PALITO_PADRAO,
  descontoPorPonto = DESCONTO_POR_PONTO,
}) {
  const peso = Number(pesoLiquidoKg) || 0
  // O preço é opcional: ele só entra na emissão da ordem. Sem ele, a
  // pré-visualização mostra o desconto medido e deixa o valor em aberto,
  // exatamente como o servidor faz.
  const temPreco = precoBaseKg !== null && precoBaseKg !== undefined && precoBaseKg !== ''
  const precoBase = temPreco ? Number(precoBaseKg) : null
  const palito = palitoPercentual === '' || palitoPercentual === null ? null : Number(palitoPercentual)

  // Sem análise ainda, não há desconto a aplicar.
  const excedente = palito === null ? 0 : Math.max(0, palito - Number(limitePalito))
  const descontoPercentual = Number((excedente * Number(descontoPorPonto)).toFixed(4))
  const precoAjustadoKg = precoBase === null
    ? null
    : Number((precoBase * (1 - descontoPercentual / 100)).toFixed(4))
  const valorTotal = precoAjustadoKg === null
    ? null
    : Number((peso * precoAjustadoKg).toFixed(2))

  return {
    excedentePalito: Number(excedente.toFixed(2)),
    descontoPercentual,
    precoAjustadoKg,
    valorTotal,
  }
}
