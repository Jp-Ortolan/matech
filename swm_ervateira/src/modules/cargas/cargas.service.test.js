// ---------------------------------------------------------------------------
// TESTE UNITÁRIO · cálculo de pagamento e peso líquido
// ---------------------------------------------------------------------------
// Cobre o RF10, conforme o Quadro 8 do artigo: "Unitários · funções e regras
// de negócio isoladas, como o cálculo de pagamento".
//
// Usa o executor de testes que já vem no Node (node:test), sem instalar nada.
// Rode com:  npm test
//
// Repare que nenhum teste toca o banco nem sobe o servidor. Isso só é possível
// porque a regra está isolada no serviço — é o que a separação em camadas
// compra na prática.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { calcularPagamento, calcularPesoLiquido, validarPrecoBase, montarFiltro } = require('./cargas.service')

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
})

describe('calcularPagamento', () => {
  test('sem análise de laboratório, não há desconto', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 7240, precoBaseKg: 4.85 })
    assert.equal(r.descontoPercentual, 0)
    assert.equal(r.precoAjustadoKg, 4.85)
    assert.equal(r.valorTotal, 35114)
  })

  test('palito dentro do limite não gera desconto', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: 5, palitoPercentual: 28 })
    assert.equal(r.excedentePalito, 0)
    assert.equal(r.valorTotal, 5000)
  })

  test('palito exatamente no limite não gera desconto', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: 5, palitoPercentual: 30 })
    assert.equal(r.descontoPercentual, 0)
    assert.equal(r.valorTotal, 5000)
  })

  test('palito acima do limite desconta o preço', () => {
    // 34% de palito, limite 30 → 4 pontos de excedente → 4% de desconto
    const r = calcularPagamento({ pesoLiquidoKg: 7240, precoBaseKg: 4.85, palitoPercentual: 34 })
    assert.equal(r.excedentePalito, 4)
    assert.equal(r.descontoPercentual, 4)
    assert.equal(r.precoAjustadoKg, 4.656)
    assert.equal(r.valorTotal, 33709.44)
  })

  test('respeita limite e desconto configuráveis', () => {
    const r = calcularPagamento({
      pesoLiquidoKg: 1000, precoBaseKg: 10,
      palitoPercentual: 40, limitePalito: 35, descontoPorPonto: 2,
    })
    // 5 pontos de excedente × 2% = 10% de desconto
    assert.equal(r.descontoPercentual, 10)
    assert.equal(r.precoAjustadoKg, 9)
    assert.equal(r.valorTotal, 9000)
  })

  test('recusa peso inválido, e preço zerado ou negativo', () => {
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 0, precoBaseKg: 5 }), /peso/i)
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 100, precoBaseKg: 0 }), /preço/i)
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 100, precoBaseKg: -2 }), /preço/i)
  })
})

// ---------------------------------------------------------------------------
// O PREÇO DEIXOU DE SER OBRIGATÓRIO — e este bloco é a garantia disso
// ---------------------------------------------------------------------------
// A qualidade é medida no laboratório, antes de o preço existir. Quem informa
// o preço é o administrativo, na emissão da ordem. Então o cálculo precisa
// saber produzir o DESCONTO sem saber o preço — e deixar o valor em aberto,
// não em zero.
//
// Zero seria pior que nulo: uma ordem de pagamento de R$ 0,00 parece um valor
// legítimo e passaria despercebida. Nulo obriga quem lê a perceber que falta.

describe('calcularPagamento sem preço', () => {
  test('mede o desconto e deixa preço e valor em aberto', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 7240, palitoPercentual: 34 })
    assert.equal(r.excedentePalito, 4)
    assert.equal(r.descontoPercentual, 4)
    assert.equal(r.precoAjustadoKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('sem preço e sem análise, o desconto é zero e o valor continua em aberto', () => {
    const r = calcularPagamento({ pesoLiquidoKg: 1000 })
    assert.equal(r.descontoPercentual, 0)
    assert.equal(r.precoAjustadoKg, null)
    assert.equal(r.valorTotal, null)
  })

  test('o desconto sem preço é o MESMO que com preço', () => {
    // É isto que permite a ordem aplicar depois, sobre o preço que ela
    // informar, o desconto que o laboratório mediu antes. Se as duas contas
    // divergissem, o valor da ordem não corresponderia à análise.
    const comPreco = calcularPagamento({ pesoLiquidoKg: 1000, precoBaseKg: 5, palitoPercentual: 37 })
    const semPreco = calcularPagamento({ pesoLiquidoKg: 1000, palitoPercentual: 37 })
    assert.equal(semPreco.descontoPercentual, comPreco.descontoPercentual)
    assert.equal(semPreco.excedentePalito, comPreco.excedentePalito)
  })

  test('aplicar o desconto medido sobre um preço informado depois dá o mesmo resultado', () => {
    // Simula o que a emissão da ordem faz: pega o desconto já gravado na
    // análise e aplica ao preço que o administrativo informou.
    const analise = calcularPagamento({ pesoLiquidoKg: 7240, palitoPercentual: 34 })
    const precoInformadoNaOrdem = 4.85

    const precoAjustado = Number((precoInformadoNaOrdem * (1 - analise.descontoPercentual / 100)).toFixed(4))
    const valor = Number((7240 * precoAjustado).toFixed(2))

    // Os mesmos números do teste 'palito acima do limite desconta o preço'.
    assert.equal(precoAjustado, 4.656)
    assert.equal(valor, 33709.44)
  })
})

// ---------------------------------------------------------------------------
// Estes testes nasceram de uma auditoria funcional do sistema, em 22/08/2026.
// A auditoria registrou uma pesagem com preço zero pela tela e o sistema
// aceitou: a checagem "preço maior que zero" existia só em calcularPagamento(),
// que roda na ANÁLISE, e não no registro da pesagem. O resultado seria uma
// ordem de pagamento de R$ 0,00 — pior que um erro, porque não parece erro.
// ---------------------------------------------------------------------------
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

  // O preço saiu da balança: quem o informa é o administrativo, na emissão da
  // ordem. Ausente virou caso NORMAL na pesagem — e continua sendo recusado
  // onde ele é indispensável, através da opção `obrigatorio`.
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
    // O número é gerado sempre em maiúsculas; quem digita, não.
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
