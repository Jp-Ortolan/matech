import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { formatar, plural, contagem } from './formatar.js'

describe('plural', () => {
  test('um é singular, o resto é plural', () => {
    assert.equal(plural(1, 'carga', 'cargas'), 'carga')
    assert.equal(plural(0, 'carga', 'cargas'), 'cargas')
    assert.equal(plural(2, 'carga', 'cargas'), 'cargas')
  })

  test('zero é plural em português', () => {
    assert.equal(plural(0, 'ordem emitida', 'ordens emitidas'), 'ordens emitidas')
  })

  test('aceita frase inteira, com o verbo concordando', () => {
    assert.equal(plural(1, 'amostra aguarda', 'amostras aguardam'), 'amostra aguarda')
    assert.equal(plural(3, 'amostra aguarda', 'amostras aguardam'), 'amostras aguardam')
  })

  test('texto numérico conta como número', () => {
    assert.equal(plural('1', 'carga', 'cargas'), 'carga')
  })
})

describe('contagem', () => {
  test('junta o número e a palavra', () => {
    assert.equal(contagem(1, 'carga', 'cargas'), '1 carga')
    assert.equal(contagem(3, 'carga', 'cargas'), '3 cargas')
  })

  test('separa milhar', () => {
    assert.equal(contagem(1204, 'carga', 'cargas'), '1.204 cargas')
  })
})

describe('formatar · ausência vira travessão', () => {
  test('nulo e indefinido nunca viram NaN nem vazio', () => {
    for (const f of ['kg', 'reais', 'numero', 'porcento', 'precoKg', 'data', 'dataHora']) {
      assert.equal(formatar[f](null), '—', f)
      assert.equal(formatar[f](undefined), '—', f)
    }
  })

  test('zero NÃO é ausência', () => {
    assert.equal(formatar.kg(0), '0 kg')
    assert.equal(formatar.numero(0), '0')
  })
})

describe('formatar · números', () => {
  test('quilo sem casas decimais', () => {
    assert.equal(formatar.kg(7240.4), '7.240 kg')
  })

  test('preço por quilo com as quatro casas do banco', () => {
    assert.match(formatar.precoKg(4.656), /4,6560\/kg$/)
    assert.match(formatar.precoKgCurto(4.656), /4,66\/kg$/)
    assert.equal(formatar.precoKgCurto(null), '—')
  })

  test('percentual com vírgula', () => {
    assert.equal(formatar.porcento(4.25, 2), '4,25%')
    assert.equal(formatar.porcento(34), '34,0%')
  })
})
