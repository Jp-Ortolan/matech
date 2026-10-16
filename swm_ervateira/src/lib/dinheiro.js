// Contas de dinheiro sem ponto flutuante.
// O peso tem 2 casas e o preço 4 casas; a conta é feita em inteiros.
// Arredondamento bancário: meio centavo vai para o centavo par.

function emInteiro(valor, casas) {
  const [inteiro, decimal = ''] = Number(valor).toFixed(casas).split('.')
  return BigInt(inteiro + decimal)
}

function arredondarBancario(numero, divisor) {
  const quociente = numero / divisor
  const resto = numero % divisor
  if (resto * 2n > divisor) return quociente + 1n
  if (resto * 2n === divisor) return quociente % 2n === 0n ? quociente : quociente + 1n
  return quociente
}

// peso (kg) x preço (R$/kg) => valor em reais, com 2 casas
function valorDaCarga(pesoKg, precoKg) {
  const produto = emInteiro(pesoKg, 2) * emInteiro(precoKg, 4)   // 6 casas
  const centavos = arredondarBancario(produto, 10000n)
  return Number(centavos) / 100
}

// soma valores que já têm 2 casas, sem acumular erro
function somarReais(valores) {
  const centavos = valores.reduce((total, v) => total + emInteiro(v, 2), 0n)
  return Number(centavos) / 100
}

module.exports = { valorDaCarga, somarReais, arredondarBancario }
