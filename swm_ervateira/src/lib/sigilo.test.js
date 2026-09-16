const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { ocultarDaCarga } = require('./sigilo')

const cargaCompleta = {
  numeroTicket: 'PES-2026-00042',
  pesoLiquidoKg: 7240,
  precoBaseKg: 4.85,
  produtor: { nome: 'José Fontana', cpfCnpj: '01234567890' },
  analise: { palitoPercentual: 34, precoAjustadoKg: 4.656, valorTotal: 33709.44 },
}

describe('ocultarDaCarga', () => {
  test('sem perfil de dinheiro, preço e valor NÃO vêm', () => {
    const r = ocultarDaCarga(cargaCompleta, { veDinheiro: false })
    assert.equal('precoBaseKg' in r, false)
    assert.equal('precoAjustadoKg' in r.analise, false)
    assert.equal('valorTotal' in r.analise, false)
    assert.equal(r.semValores, true)
  })

  test('remove em vez de zerar — zero entraria numa soma e daria total errado', () => {
    const r = ocultarDaCarga(cargaCompleta, { veDinheiro: false })
    assert.notEqual(r.precoBaseKg, 0)
    assert.equal(r.precoBaseKg, undefined)
  })

  test('a qualidade continua visível para quem não vê dinheiro', () => {
    const r = ocultarDaCarga(cargaCompleta, { veDinheiro: false })
    assert.equal(r.analise.palitoPercentual, 34)
    assert.equal(r.pesoLiquidoKg, 7240)
  })

  test('com perfil de dinheiro, os valores vêm inteiros', () => {
    const r = ocultarDaCarga(cargaCompleta, { veDinheiro: true })
    assert.equal(r.precoBaseKg, 4.85)
    assert.equal(r.analise.valorTotal, 33709.44)
  })

  test('o CPF do produtor NÃO é mais mascarado', () => {
    const r = ocultarDaCarga(cargaCompleta, { veDinheiro: false })
    assert.equal(r.produtor.cpfCnpj, '01234567890')
  })

  test('não modifica a carga original', () => {
    ocultarDaCarga(cargaCompleta, { veDinheiro: false })
    assert.equal(cargaCompleta.precoBaseKg, 4.85)
    assert.equal(cargaCompleta.analise.valorTotal, 33709.44)
  })
})
