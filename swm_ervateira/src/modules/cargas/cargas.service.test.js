const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { calcularPagamento, calcularPesoLiquido, validarPrecoBase, validarMetragem, montarFiltro } = require('./cargas.service')

describe('calcularPesoLiquido', () => {
  test('subtrai a tara do peso bruto', () => {
    assert.equal(calcularPesoLiquido(8420, 1180), 7240)
  })

  test('recusa tara maior ou igual ao peso bruto', () => {
    assert.throws(() => calcularPesoLiquido(1000, 1000), /tara/i)
    assert.throws(() => calcularPesoLiquido(1000, 2000), /tara/i)
  })

  test('recusa peso bruto zerado ou negativo', () => {
    assert.throws(() => calcularPesoLiquido(0, 0), /peso bruto/i)
    assert.throws(() => calcularPesoLiquido(-500, 100), /peso bruto/i)
  })

  test('recusa tara ausente, nula ou não numérica', () => {
    assert.throws(() => calcularPesoLiquido(8420, undefined), /informe a tara/i)
    assert.throws(() => calcularPesoLiquido(8420, null), /informe a tara/i)
    assert.throws(() => calcularPesoLiquido(8420, ''), /informe a tara/i)
    assert.throws(() => calcularPesoLiquido(8420, 'abc'), /número/i)
  })

  test('recusa tara zerada — um caminhão vazio pesa alguma coisa', () => {
    assert.throws(() => calcularPesoLiquido(8420, 0), /maior que zero/i)
  })

  test('recusa tara negativa', () => {
    assert.throws(() => calcularPesoLiquido(8420, -5), /maior que zero/i)
  })

  test('nunca devolve NaN', () => {
    for (const lixo of [undefined, null, '', 'abc', {}, []]) {
      assert.throws(() => calcularPesoLiquido(8420, lixo))
    }
  })
})

describe('validarMetragem', () => {
  test('aceita metragem em carga de lenha', () => {
    assert.equal(validarMetragem(12.5, 'LENHA'), 12.5)
    assert.equal(validarMetragem('8', 'LENHA'), 8)
  })

  test('vazio é ausência, e ausência é permitida', () => {
    assert.equal(validarMetragem('', 'LENHA'), null)
    assert.equal(validarMetragem(null, 'LENHA'), null)
    assert.equal(validarMetragem(undefined, 'ERVA_MATE_NATIVA'), null)
  })

  test('recusa metragem em carga que não é lenha', () => {
    assert.throws(() => validarMetragem(10, 'ERVA_MATE_NATIVA'), /lenha/i)
    assert.throws(() => validarMetragem(10, 'PALITO'), /lenha/i)
  })

  test('recusa zero, negativo e não-número', () => {
    assert.throws(() => validarMetragem(0, 'LENHA'), /maior que zero/i)
    assert.throws(() => validarMetragem(-3, 'LENHA'), /maior que zero/i)
    assert.throws(() => validarMetragem('doze', 'LENHA'), /número/i)
  })

  test('recusa metragem fora da faixa plausível de um caminhão', () => {
    assert.throws(() => validarMetragem(5000, 'LENHA'), /plausível/i)
  })

  test('arredonda em duas casas, como o banco guarda', () => {
    assert.equal(validarMetragem(12.567, 'LENHA'), 12.57)
  })
})

describe('calcularPagamento', () => {
  test('valor é peso líquido vezes preço por quilo', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 7240, precoBaseKg: 4.85 })
    assert.equal(r.precoBaseKg, 4.85)
    assert.equal(r.valorTotal, 35114)
  })

  test('arredonda o valor em duas casas', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1234.56, precoBaseKg: 2.37 })
    assert.equal(r.valorTotal, 2925.91)
  })

  test('devolve o peso e o preço que recebeu', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: 5 })
    assert.equal(r.pesoLiquidoKg, 1000)
    assert.equal(r.valorTotal, 5000)
  })

  test('recusa peso inválido, e preço zerado ou negativo', () => {
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 0, precoBaseKg: 5 }), /peso/i)
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 100, precoBaseKg: 0 }), /preço/i)
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 100, precoBaseKg: -2 }), /preço/i)
  })
})

describe('calcularPagamento sem preço', () => {
  test('sem preço, o valor fica em aberto e não em zero', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 7240 })
    assert.equal(r.precoBaseKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('string vazia conta como ausência de preço, não como zero', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: '' })
    assert.equal(r.precoBaseKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('o preço informado depois produz o valor da ordem', () => {
    const analise = calcularPagamento({ pesoLiquidoKg: 7240 })
    assert.equal(analise.valorTotal, null)

    const naOrdem = calcularPagamento({ pesoLiquidoKg: 7240, precoBaseKg: 4.85 })
    assert.equal(naOrdem.valorTotal, 35114)
  })
})

describe('validarPrecoBase', () => {
  test('aceita um preço positivo e arredonda para quatro casas', () => {
    assert.equal(validarPrecoBase(4.85), 4.85)
    assert.equal(validarPrecoBase('4.856789'), 4.8568)
  })

  test('recusa preço zero', () => {
    assert.throws(() => validarPrecoBase(0), /maior que zero/i)
  })

  test('recusa preço negativo', () => {
    assert.throws(() => validarPrecoBase(-5), /maior que zero/i)
  })

  test('aceita preço ausente: a balança não pede preço', () => {
    assert.equal(validarPrecoBase(undefined), null)
    assert.equal(validarPrecoBase(null), null)
    assert.equal(validarPrecoBase(''), null)
  })

  test('recusa preço ausente quando quem chama exige', () => {
    assert.throws(() => validarPrecoBase(undefined, { obrigatorio: true }), /informe o preço/i)
    assert.throws(() => validarPrecoBase(null, { obrigatorio: true }), /informe o preço/i)
    assert.throws(() => validarPrecoBase('', { obrigatorio: true }), /informe o preço/i)
  })

  test('recusa texto que não é número', () => {
    assert.throws(() => validarPrecoBase('quatro reais'), /número/i)
  })
})

describe('montarFiltro · busca por ticket ou produtor', () => {
  test('sem busca, não acrescenta condição nenhuma', () => {
    assert.equal(montarFiltro({}).OR, undefined)
    assert.equal(montarFiltro({ busca: '   ' }).OR, undefined)
  })

  test('procura nos dois campos ao mesmo tempo', () => {
    const where = montarFiltro({ busca: 'jose' })
    assert.equal(where.OR.length, 2)
    assert.equal(where.OR[0].numeroTicket.contains, 'JOSE')
    assert.equal(where.OR[1].produtor.nome.contains, 'jose')
    assert.equal(where.OR[1].produtor.nome.mode, 'insensitive')
  })

  test('ticket digitado em minúsculas encontra o ticket', () => {
    assert.equal(montarFiltro({ busca: 'pes-2026-01184' }).OR[0].numeroTicket.contains, 'PES-2026-01184')
  })

  test('espaços em volta não atrapalham', () => {
    assert.equal(montarFiltro({ busca: '  Marlene  ' }).OR[1].produtor.nome.contains, 'Marlene')
  })

  test('a busca convive com os outros filtros', () => {
    const where = montarFiltro({ busca: 'jose', situacao: 'ANALISADA', produtorId: 'p1' })
    assert.equal(where.situacao, 'ANALISADA')
    assert.equal(where.produtorId, 'p1')
    assert.ok(where.OR)
  })
})
