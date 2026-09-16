function ocultarDaCarga(carga, { veDinheiro }) {
  if (!carga) return carga
  if (veDinheiro) return carga

  const limpa = { ...carga }
  delete limpa.precoBaseKg
  if (limpa.analise) {
    limpa.analise = { ...limpa.analise }
    delete limpa.analise.precoAjustadoKg
    delete limpa.analise.valorTotal
  }
  limpa.semValores = true
  return limpa
}

module.exports = { ocultarDaCarga }
