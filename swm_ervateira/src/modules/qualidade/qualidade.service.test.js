// ---------------------------------------------------------------------------
// TESTES · regra de valor da análise
// ---------------------------------------------------------------------------
// Cobrem a decisão que a análise toma sobre dinheiro, sem subir o banco: a
// função testada é pura justamente para isso.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { valorDaAnalise } = require('./qualidade.service')
const { calcularPagamento } = require('../cargas/cargas.service')

describe('valorDaAnalise', () => {
  const calculoComPreco = calcularPagamento({
    pesoLiquidoKg: 7240,
    precoBaseKg: 4.85,
    palitoPercentual: 34,   // 4 p.p. acima do limite → 4% de desconto
  })

  test('carga aprovada leva o valor calculado', () => {
    const r = valorDaAnalise(calculoComPreco, true)
    assert.equal(r.precoAjustadoKg, 4.656)
    assert.equal(r.valorTotal, 33709.44)
  })

  test('carga REPROVADA não leva valor nenhum', () => {
    const r = valorDaAnalise(calculoComPreco, false)
    assert.equal(r.precoAjustadoKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('carga reprovada continua sem valor mesmo com preço alto', () => {
    const calculo = calcularPagamento({ pesoLiquidoKg: 10000, precoBaseKg: 9, palitoPercentual: 10 })
    assert.equal(calculo.valorTotal, 90000)          // valeria isso
    assert.equal(valorDaAnalise(calculo, false).valorTotal, null)   // mas não vale
  })

  test('carga sem preço fica sem valor, aprovada ou não', () => {
    const calculo = calcularPagamento({ pesoLiquidoKg: 5180, palitoPercentual: 22 })
    assert.equal(valorDaAnalise(calculo, true).valorTotal, null)
    assert.equal(valorDaAnalise(calculo, false).valorTotal, null)
    // O desconto medido continua existindo — ele não depende de preço.
    assert.equal(calculo.descontoPercentual, 0)
  })

  test('o desconto medido sobrevive à reprovação', () => {
    // Reprovar não apaga a medição do laboratório; apaga o dinheiro.
    const calculo = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: 5, palitoPercentual: 45 })
    assert.equal(calculo.descontoPercentual, 15)
    assert.equal(valorDaAnalise(calculo, false).precoAjustadoKg, null)
  })
})
