const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { valorDaAnalise } = require('./qualidade.service')
const { calcularPagamento } = require('../cargas/cargas.service')

describe('valorDaAnalise', () => {
  const calculoComPreco = calcularPagamento({ pesoLiquidoKg: 7240, precoBaseKg: 4.85 })

  test('carga aprovada leva o preço acordado e o valor calculado', () => {
    const r = valorDaAnalise(calculoComPreco, true)
    assert.equal(r.precoAjustadoKg, 4.85)
    assert.equal(r.valorTotal, 35114)
  })

  test('carga REPROVADA não leva valor nenhum', () => {
    const r = valorDaAnalise(calculoComPreco, false)
    assert.equal(r.precoAjustadoKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('carga reprovada continua sem valor mesmo com preço alto', () => {
    const calculo = calcularPagamento({ pesoLiquidoKg: 10000, precoBaseKg: 9 })
    assert.equal(calculo.valorTotal, 90000)                        // valeria isso
    assert.equal(valorDaAnalise(calculo, false).valorTotal, null)   // mas não vale
  })

  test('carga sem preço fica sem valor, aprovada ou não', () => {
    const calculo = calcularPagamento({ pesoLiquidoKg: 5180 })
    assert.equal(valorDaAnalise(calculo, true).valorTotal, null)
    assert.equal(valorDaAnalise(calculo, false).valorTotal, null)
  })
})
