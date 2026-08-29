// ---------------------------------------------------------------------------
// TESTES · montagem dos números do painel
// ---------------------------------------------------------------------------
// As consultas em si dependem do PostgreSQL. O que dá para travar sem banco é
// o tratamento do resultado — e é justamente ali que estavam os dois defeitos
// que aparecem em banco novo, que é o estado em que a banca vê o sistema.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { contagensPorSituacao, numero, SITUACOES } = require('./dashboard.service')

describe('contagensPorSituacao', () => {
  test('devolve sempre as cinco situações', () => {
    const r = contagensPorSituacao([{ situacao: 'PAGA', _count: { _all: 3 } }])
    assert.deepEqual(Object.keys(r).sort(), [...SITUACOES].sort())
  })

  test('situação sem nenhuma carga vira ZERO, e não some', () => {
    // O GROUP BY não devolve linha para situação vazia. Sem esta garantia a
    // barra do ciclo desaparece e o percentual sai "NaN%".
    const r = contagensPorSituacao([{ situacao: 'AGUARDANDO_ANALISE', _count: { _all: 2 } }])
    assert.equal(r.REPROVADA, 0)
    assert.equal(r.PAGA, 0)
  })

  test('banco vazio devolve cinco zeros, não um objeto vazio', () => {
    const r = contagensPorSituacao([])
    assert.equal(Object.values(r).every((n) => n === 0), true)
    assert.equal(Object.keys(r).length, 5)
  })

  test('aguenta resultado ausente', () => {
    assert.equal(contagensPorSituacao(undefined).PAGA, 0)
  })

  test('situação desconhecida não entra no objeto', () => {
    // Se alguém acrescentar um valor ao enum e esquecer da lista daqui, o
    // painel ignora em vez de desenhar uma barra sem rótulo.
    const r = contagensPorSituacao([{ situacao: 'CANCELADA', _count: { _all: 9 } }])
    assert.equal('CANCELADA' in r, false)
  })
})

describe('numero', () => {
  test('soma vazia vira zero, e não nulo', () => {
    // SUM() de tabela vazia devolve NULL no PostgreSQL. Sem isto, o peso total
    // do painel sai "—" num sistema que tem cargas, ou "NaN" numa divisão.
    assert.equal(numero(null), 0)
    assert.equal(numero(undefined), 0)
  })

  test('Decimal do Prisma vira número de verdade', () => {
    assert.equal(numero('7240.00'), 7240)
    assert.equal(numero({ toString: () => '33709.44' }), 33709.44)
  })

  test('arredonda para dois, que é o que o dinheiro tem', () => {
    assert.equal(numero(4.6560), 4.66)
  })
})
