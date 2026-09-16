const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { montarItens, mapearPrecos } = require('./pagamentos.service')

function carga(id, { peso, ticket = 'PES-2026-00001' }) {
  return {
    id,
    numeroTicket: ticket,
    pesoLiquidoKg: peso,
    analise: { id: `an-${id}` },
  }
}

describe('montarItens', () => {
  test('o valor é peso vezes o preço acordado', () => {
    const itens = montarItens(
      [carga('c1', { peso: 5180 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 4.8 }])
    )
    assert.equal(itens[0].precoBaseKg, 4.8)
    assert.equal(itens[0].precoKg, 4.8)
    assert.equal(itens[0].valor, 24864)
  })

  test('guarda os dois preços do mesmo momento', () => {
    const itens = montarItens(
      [carga('c1', { peso: 1000 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 0.8 }])
    )
    assert.equal(itens[0].precoBaseKg, itens[0].precoKg,
      'o preço acordado e o preço pago têm de ser o mesmo')
  })

  test('cada carga leva o seu preço', () => {
    const itens = montarItens(
      [carga('c1', { peso: 1000 }), carga('c2', { peso: 2000 })],
      mapearPrecos([{ cargaId: 'c1', precoKg: 5 }, { cargaId: 'c2', precoKg: 1.2 }])
    )
    assert.equal(itens[0].valor, 5000)
    assert.equal(itens[1].precoKg, 1.2)
    assert.equal(itens[1].valor, 2400)
  })

  test('carga sem preço informado recusa a emissão', () => {
    assert.throws(
      () => montarItens([carga('c1', { peso: 1000, ticket: 'PES-2026-01185' })], mapearPrecos([])),
      /PES-2026-01185/
    )
  })

  test('preço zero ou negativo é recusado antes de virar ordem', () => {
    assert.throws(() => mapearPrecos([{ cargaId: 'c1', precoKg: 0 }]), /maior que zero/)
    assert.throws(() => mapearPrecos([{ cargaId: 'c1', precoKg: -2 }]), /maior que zero/)
  })
})
