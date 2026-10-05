const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { lerAviso } = require('./aparelhos.service')

describe('lerAviso · contato do aparelho', () => {
  test('aceita o aviso normal', () => {
    assert.deepEqual(
      lerAviso({ dispositivoId: 'a1b2c3d4-e5f6', naFila: 3, comErro: 1 }),
      { id: 'a1b2c3d4-e5f6', naFila: 3, comErro: 1 }
    )
  })

  test('contagem ausente vale zero', () => {
    assert.equal(lerAviso({ dispositivoId: 'a1b2c3d4-e5f6' }).naFila, 0)
  })

  test('recusa contagem negativa ou quebrada', () => {
    assert.throws(() => lerAviso({ dispositivoId: 'a1b2c3d4-e5f6', naFila: -1 }), /inteiro/)
    assert.throws(() => lerAviso({ dispositivoId: 'a1b2c3d4-e5f6', naFila: 2.5 }), /inteiro/)
    assert.throws(() => lerAviso({ dispositivoId: 'a1b2c3d4-e5f6', comErro: 'x' }), /inteiro/)
  })

  test('recusa aparelho sem identificador', () => {
    assert.throws(() => lerAviso({}), /aparelho/)
    assert.throws(() => lerAviso({ dispositivoId: 'curto' }), /aparelho/)
  })
})
