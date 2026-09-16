function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function digitoPorPesos(digitos, pesos) {
  const soma = pesos.reduce((total, peso, i) => total + digitos[i] * peso, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

function cpfValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 11) return false

  if (d.every((n) => n === d[0])) return false

  const primeiro = digitoPorPesos(d, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = digitoPorPesos(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d[9] === primeiro && d[10] === segundo
}

function cnpjValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 14) return false
  if (d.every((n) => n === d[0])) return false

  const primeiro = digitoPorPesos(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = digitoPorPesos(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d[12] === primeiro && d[13] === segundo
}

function documentoValido(valor) {
  const d = apenasDigitos(valor)
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

function erroNoDocumento(valor) {
  const d = apenasDigitos(valor)
  if (!d) return 'Informe o CPF ou CNPJ'
  if (d.length !== 11 && d.length !== 14) {
    return `CPF tem 11 dígitos e CNPJ tem 14 — foram digitados ${d.length}`
  }
  if (!documentoValido(d)) {
    return d.length === 11
      ? 'CPF inválido: confira os números, algum dígito está trocado'
      : 'CNPJ inválido: confira os números, algum dígito está trocado'
  }
  return null
}

function formatarDocumento(valor) {
  const d = apenasDigitos(valor)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return valor
}

module.exports = {
  apenasDigitos,
  cpfValido,
  cnpjValido,
  documentoValido,
  erroNoDocumento,
  formatarDocumento,
}
