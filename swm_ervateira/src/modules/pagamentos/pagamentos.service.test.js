// ---------------------------------------------------------------------------
// TESTES · montagem dos itens da ordem de pagamento
// ---------------------------------------------------------------------------
// É aqui que o preço acordado pelo administrativo encontra o desconto que o
// laboratório já mediu. A função é pura, então o teste roda sem PostgreSQL.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { montarItens, mapearPrecos } = require('./pagamentos.service')

function carga(id, { peso, desconto, ticket = 'PES-2026-00001' }) {
  return {
    id,
    numeroTicket: ticket,
    pesoLiquidoKg: peso,
    analise: { id: `an-${id}`, descontoPercentual: desconto },
  }
}

describe('montarItens', () => {
  test('sem desconto, o preço pago é o preço acordado', () => {
    const itens = montarItens(
      [carga('c1', { peso: 5180, desconto: 0 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 4.8 }])
    )
    assert.equal(itens[0].precoBaseKg, 4.8)
    assert.equal(itens[0].precoKg, 4.8)
    assert.equal(itens[0].valor, 24864)
  })

  test('o desconto medido reduz o preço acordado, não o da balança', () => {
    // 4 p.p. acima do limite → 4% de desconto sobre os R$ 5,00 acordados.
    const itens = montarItens(
      [carga('c1', { peso: 7240, desconto: 4 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 5 }])
    )
    assert.equal(itens[0].precoBaseKg, 5)
    assert.equal(itens[0].precoKg, 4.8)
    assert.equal(itens[0].valor, 34752)
  })

  test('guarda os dois preços do mesmo momento', () => {
    // A regressão que isto trava: base e ajustado vinham de momentos
    // diferentes — a base da pesagem, o ajustado da emissão — e a diferença
    // entre eles era lida como desconto nas telas de relatório.
    const itens = montarItens(
      [carga('c1', { peso: 1000, desconto: 0 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 0.8 }])
    )
    assert.equal(itens[0].precoBaseKg, itens[0].precoKg,
      'sem desconto, base e ajustado têm de ser iguais')
  })

  test('cada carga leva o seu preço', () => {
    const itens = montarItens(
      [carga('c1', { peso: 1000, desconto: 0 }), carga('c2', { peso: 2000, desconto: 10 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 5 }, { cargaId: 'c2', precoKg: 1.2 }])
    )
    assert.equal(itens[0].valor, 5000)
    assert.equal(itens[1].precoKg, 1.08)
    assert.equal(itens[1].valor, 2160)
  })

  test('carga sem preço informado recusa a emissão', () => {
    assert.throws(
      () => montarItens([carga('c1', { peso: 1000, desconto: 0, ticket: 'PES-2026-01185' })], mapearPrecos([])),
      /PES-2026-01185/
    )
  })

  test('preço zero ou negativo é recusado antes de virar ordem', () => {
    assert.throws(() => mapearPrecos([{ cargaId: 'c1', precoKg: 0 }]), /maior que zero/)
    assert.throws(() => mapearPrecos([{ cargaId: 'c1', precoKg: -2 }]), /maior que zero/)
  })
})
