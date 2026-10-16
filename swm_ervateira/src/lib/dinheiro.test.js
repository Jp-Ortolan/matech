const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { valorDaCarga, somarReais, arredondarBancario } = require('./dinheiro')

describe('arredondamento bancário', () => {
  it('meio centavo vai para o par', () => {
    assert.equal(arredondarBancario(125n, 10n), 12n)
    assert.equal(arredondarBancario(135n, 10n), 14n)
  })
  it('fora do meio arredonda normal', () => {
    assert.equal(arredondarBancario(124n, 10n), 12n)
    assert.equal(arredondarBancario(126n, 10n), 13n)
  })
})

describe('valorDaCarga', () => {
  it('casos que davam R$ 0,01 de diferença', () => {
    assert.equal(valorDaCarga(20287.5, 2.166), 43942.72)
    assert.equal(valorDaCarga(18434.23, 5.5), 101388.26)
    assert.equal(valorDaCarga(38702.64, 3.6875), 142715.98)
    assert.equal(valorDaCarga(28378.76, 5.875), 166725.22)
  })
  it('contas comuns', () => {
    assert.equal(valorDaCarga(7240, 4.85), 35114)
    assert.equal(valorDaCarga(1234.56, 2.37), 2925.91)
  })
})

describe('somarReais', () => {
  it('soma sem erro de ponto flutuante', () => {
    assert.equal(somarReais([0.1, 0.2]), 0.3)
    assert.equal(somarReais([43942.72, 101388.26]), 145330.98)
  })
})
