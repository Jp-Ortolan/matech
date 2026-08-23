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

const { calcularPagamento, calcularPesoLiquido, validarPrecoBase } = require('./cargas.service')

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

  test('recusa peso ou preço inválidos', () => {
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 0, precoBaseKg: 5 }), /peso/i)
    assert.throws(() => calcularPagamento({ pesoLiquidoKg: 100, precoBaseKg: 0 }), /preço/i)
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

  test('recusa preço ausente, em vez de deixar virar NaN no banco', () => {
    assert.throws(() => validarPrecoBase(undefined), /informe o preço/i)
    assert.throws(() => validarPrecoBase(null), /informe o preço/i)
    assert.throws(() => validarPrecoBase(''), /informe o preço/i)
  })

  test('recusa texto que não é número', () => {
    assert.throws(() => validarPrecoBase('quatro reais'), /número/i)
  })
})
