export function motivosDaAnalise(analise) {
  if (!analise) return []
  return analise.motivoReprovacao ? [analise.motivoReprovacao] : []
}

export function motivoResumido(analise) {
  const frases = motivosDaAnalise(analise)
  if (!frases.length) return 'Motivo não registrado.'
  return frases.join(' ')
}
