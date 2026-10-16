const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { numeroNaFaixa, daLista, lerData, paginacao, coordenada } = require('./validacao')

describe('numeroNaFaixa', () => {
  test('aceita número dentro da faixa, inclusive no limite', () => {
    assert.equal(numeroNaFaixa('1.000', { rotulo: 'o peso', min: 1000, max: 80000 }), 1000)
    assert.equal(numeroNaFaixa(80000, { rotulo: 'o peso', min: 1000, max: 80000 }), 80000)
  })
  test('recusa abaixo do mínimo e acima do máximo', () => {
    assert.throws(() => numeroNaFaixa(999, { rotulo: 'o peso', min: 1000 }), /pelo menos/)
    assert.throws(() => numeroNaFaixa(80001, { rotulo: 'o peso', max: 80000 }), /no máximo/)
  })
  test('recusa texto que não é número', () => {
    assert.throws(() => numeroNaFaixa('abc', { rotulo: 'o peso' }), /número/)
  })
  test('vazio vira null, a não ser que seja obrigatório', () => {
    assert.equal(numeroNaFaixa('', { rotulo: 'o peso' }), null)
    assert.throws(() => numeroNaFaixa('', { rotulo: 'o peso', obrigatorio: true }), /Informe/)
  })
  test('inteiro recusa casa decimal', () => {
    assert.throws(() => numeroNaFaixa('2,5', { rotulo: 'a idade', inteiro: true }), /inteiro/)
  })
})

describe('daLista', () => {
  test('aceita valor da lista e devolve o padrão quando vazio', () => {
    assert.equal(daLista('LENHA', 'tipoMateriaPrima', 'o tipo'), 'LENHA')
    assert.equal(daLista(undefined, 'tipoErva', 'o tipo', 'NATIVA'), 'NATIVA')
  })
  test('recusa valor fora da lista e mostra as opções', () => {
    assert.throws(() => daLista('xyz', 'tipoMateriaPrima', 'o tipo'), (e) => e.detalhe.includes('LENHA'))
  })
})

describe('lerData', () => {
  test('lê data ISO', () => {
    assert.equal(lerData('2026-10-07T20:05:00Z', 'a data').toISOString(), '2026-10-07T20:05:00.000Z')
  })
  test('recusa texto que não é data e ano absurdo', () => {
    assert.throws(() => lerData('abc', 'a data'), /inválida/)
    assert.throws(() => lerData('9999-01-01', 'a data'), /período/)
  })
  test('com semFuturo, recusa data além de um dia à frente', () => {
    const daqui10Dias = new Date(Date.now() + 10 * 86400000).toISOString()
    assert.throws(() => lerData(daqui10Dias, 'a data', { semFuturo: true }), /futuro/)
  })
})

describe('paginacao', () => {
  test('página negativa ou texto vira 1, tamanho respeita o máximo', () => {
    assert.deepEqual(paginacao({ pagina: '-5', porPagina: '9999' }), { pagina: 1, porPagina: 200 })
    assert.deepEqual(paginacao({ pagina: 'abc' }), { pagina: 1, porPagina: 20 })
  })
})

describe('coordenada', () => {
  test('recusa ponto fora do globo', () => {
    assert.throws(() => coordenada(95, 'latitude'), /no máximo/)
    assert.equal(coordenada(-25.39, 'latitude'), -25.39)
  })
})
