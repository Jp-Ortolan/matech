// ---------------------------------------------------------------------------
// POR QUE A CARGA FOI REPROVADA
// ---------------------------------------------------------------------------
// Espelho de src/modules/qualidade/limites.js, no mesmo espírito do
// lib/calculo.js: a análise que chega nas telas já traz as medidas e os
// limites que valiam no dia, então a frase pode ser montada aqui, sem uma
// requisição a mais por linha de tabela.
//
// E ela é montada a partir dos limites GRAVADOS na análise, não dos parâmetros
// de hoje. Se a ervateira apertar a régua no ano que vem, o laudo de hoje
// continua dizendo o que disse — que é a única forma de o produtor conferir
// uma reprovação antiga.

function pct(v) {
  return `${Number(v).toFixed(1).replace('.', ',')}%`
}

/** As frases que explicam a reprovação, na ordem em que se lê. */
export function motivosDaAnalise(analise) {
  if (!analise) return []
  const frases = []

  const { palitoPercentual, umidadePercentual, folhaPercentual } = analise
  const { palitoMaximo, umidadeMaxima, folhaMinima } = analise

  if (palitoMaximo != null && palitoPercentual != null && Number(palitoPercentual) > Number(palitoMaximo)) {
    frases.push(`Palito de ${pct(palitoPercentual)}, acima do máximo de ${pct(palitoMaximo)}.`)
  }
  if (umidadeMaxima != null && umidadePercentual != null && Number(umidadePercentual) > Number(umidadeMaxima)) {
    frases.push(`Umidade de ${pct(umidadePercentual)}, acima do máximo de ${pct(umidadeMaxima)}.`)
  }
  // Folha é o invertido: quem compra erva-mate compra folha.
  if (folhaMinima != null && folhaPercentual != null && Number(folhaPercentual) < Number(folhaMinima)) {
    frases.push(`Folha de ${pct(folhaPercentual)}, abaixo do mínimo de ${pct(folhaMinima)}.`)
  }

  if (analise.motivoReprovacao) frases.push(analise.motivoReprovacao)
  return frases
}

/**
 * Uma linha só, para caber numa célula de tabela.
 *
 * Quando não há motivo registrado — reprovação antiga, de antes de os limites
 * existirem — devolve texto explicando isso, e não vazio. Célula vazia numa
 * coluna chamada "motivo" parece defeito.
 */
export function motivoResumido(analise) {
  const frases = motivosDaAnalise(analise)
  if (!frases.length) return 'Motivo não registrado.'
  return frases.join(' ')
}
