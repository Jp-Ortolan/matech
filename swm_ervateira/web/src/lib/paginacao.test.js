import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { faixaDePaginas } from './paginacao.js'

describe('faixaDePaginas', () => {
  test('poucas páginas aparecem todas', () => {
    assert.deepEqual(faixaDePaginas(1, 3), [1, 2, 3])
    assert.deepEqual(faixaDePaginas(4, 7), [1, 2, 3, 4, 5, 6, 7])
  })

  test('no meio, mostra as vizinhas e as pontas', () => {
    assert.deepEqual(faixaDePaginas(6, 12), [1, null, 5, 6, 7, null, 12])
  })

  test('na primeira página não sobra reticência à esquerda', () => {
    assert.deepEqual(faixaDePaginas(1, 12), [1, 2, null, 12])
  })

  test('na última não sobra reticência à direita', () => {
    assert.deepEqual(faixaDePaginas(12, 12), [1, null, 11, 12])
  })

  test('reticência não substitui UM número só', () => {
    const r = faixaDePaginas(3, 12)
    assert.deepEqual(r, [1, 2, 3, 4, null, 12])
    assert.equal(r.indexOf(null), 4)
  })

  test('a página atual está sempre na faixa', () => {
    for (const atual of [1, 2, 5, 9, 20]) {
      assert.ok(faixaDePaginas(atual, 20).includes(atual), `página ${atual}`)
    }
  })

  test('uma página só não vira lista vazia', () => {
    assert.deepEqual(faixaDePaginas(1, 1), [1])
  })
})
