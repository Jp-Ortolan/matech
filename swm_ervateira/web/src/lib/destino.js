import { formatar } from './formatar'

export function descreverDestino(ordem) {
  const forma = ordem?.formaPagamentoSnapshot

  if (forma === 'DINHEIRO') return 'Dinheiro, no balcão'

  if (forma === 'CONTA_BANCARIA') {
    const partes = [
      ordem.bancoSnapshot,
      ordem.agenciaSnapshot ? `ag ${ordem.agenciaSnapshot}` : null,
      ordem.contaSnapshot
        ? `${ordem.tipoContaSnapshot === 'POUPANCA' ? 'poupança' : 'c/c'} ${ordem.contaSnapshot}`
        : null,
    ].filter(Boolean)
    return partes.length ? partes.join(' · ') : 'Conta bancária não informada'
  }

  if (ordem?.chavePixSnapshot) {
    const tipo = ordem.tipoChavePixSnapshot ? `${formatar.chavePix(ordem.tipoChavePixSnapshot)} ` : ''
    return `Pix · ${tipo}${ordem.chavePixSnapshot}`
  }
  return 'Destino não registrado'
}
