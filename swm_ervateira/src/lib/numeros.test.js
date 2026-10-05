const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { lerNumero, estaVazio } = require('./numeros')

describe('lerNumero', () => {
  test('número JSON passa direto', () => {
    assert.equal(lerNumero(4.85), 4.85)
    assert.equal(lerNumero(7240), 7240)
  })

  test('vírgula é decimal', () => {
    assert.equal(lerNumero('4,85'), 4.85)
    assert.equal(lerNumero(' 4,85 '), 4.85)
  })

  test('ponto é milhar', () => {
    assert.equal(lerNumero('7.240'), 7240)
    assert.equal(lerNumero('7.240,5'), 7240.5)
    assert.equal(lerNumero('1.000.000'), 1000000)
  })

  test('formato ambíguo é recusado', () => {
    assert.ok(Number.isNaN(lerNumero('4.85')))     // decimal com ponto
    assert.ok(Number.isNaN(lerNumero('1,234.5')))  // padrão americano
    assert.ok(Number.isNaN(lerNumero('72.40')))    // milhar mal agrupado
    assert.ok(Number.isNaN(lerNumero('4,8,5')))
  })

  test('lixo é recusado', () => {
    for (const v of ['abc', '', '  ', true, [], {}, null, undefined, Infinity]) {
      assert.ok(Number.isNaN(lerNumero(v)), String(v))
    }
  })

  test('aceita o Decimal do Prisma', () => {
    assert.equal(lerNumero({ toNumber: () => 12.5 }), 12.5)
  })
})

describe('estaVazio', () => {
  test('vazio, nulo e só espaço', () => {
    assert.ok(estaVazio(''))
    assert.ok(estaVazio('  '))
    assert.ok(estaVazio(null))
    assert.ok(estaVazio(undefined))
    assert.ok(!estaVazio(0))
  })
})
