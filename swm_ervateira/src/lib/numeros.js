// Leitura de números que chegam do cliente (peso, tara, preço, percentuais).
//
// Número JSON passa direto. Texto segue o padrão brasileiro, igual ao app:
// vírgula separa os decimais e ponto só separa milhar. Formato que não se
// encaixa (ex.: "4.85", "1,234.5", "abc") vira NaN: é recusado, não adivinhado.

const DICA_FORMATO = 'Use vírgula para os decimais e ponto só para milhar. Ex.: 4,85 ou 7.240,5.'

const SEM_MILHAR = /^-?\d+(,\d+)?$/
const COM_MILHAR = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/

function lerNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN
  // Decimal do Prisma (valor que já veio do banco).
  if (valor && typeof valor.toNumber === 'function') return valor.toNumber()
  if (typeof valor !== 'string') return NaN

  const texto = valor.trim()
  if (SEM_MILHAR.test(texto) || COM_MILHAR.test(texto)) {
    return Number(texto.replace(/\./g, '').replace(',', '.'))
  }
  return NaN
}

function estaVazio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')
}

module.exports = { lerNumero, estaVazio, DICA_FORMATO }
