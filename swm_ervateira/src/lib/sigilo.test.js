// ---------------------------------------------------------------------------
// TESTES · mascaramento de dado pessoal e de valor
// ---------------------------------------------------------------------------
// O que estes testes protegem: um dia alguém mexe no formato da máscara e o
// CPF inteiro volta a sair do servidor sem ninguém perceber.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { mascararDocumento, mascararChavePix, ocultarDoProdutor, ocultarDaCarga } = require('./sigilo')

describe('mascararDocumento', () => {
  test('CPF mostra os três primeiros e os dois do verificador', () => {
    assert.equal(mascararDocumento('12345678901'), '123.***.***-01')
  })

  test('CNPJ mostra os dois primeiros e os dois últimos', () => {
    assert.equal(mascararDocumento('12345678000199'), '12.***.***/****-99')
  })

  test('aceita o documento já pontuado', () => {
    assert.equal(mascararDocumento('123.456.789-01'), '123.***.***-01')
  })

  test('nunca devolve o documento inteiro', () => {
    // A trava principal: qualquer entrada, o resultado não pode conter os
    // onze dígitos em sequência.
    for (const doc of ['12345678901', '12345678000199', '999', '']) {
      assert.equal(mascararDocumento(doc).replace(/\D/g, '').length < 11, true, doc)
    }
  })
})

describe('mascararChavePix', () => {
  test('e-mail preserva o domínio, para dar para reconhecer', () => {
    assert.equal(mascararChavePix('joao@gmail.com', 'EMAIL'), 'jo**@gmail.com')
  })

  test('telefone mostra só os quatro últimos', () => {
    assert.equal(mascararChavePix('42999887766', 'TELEFONE'), '*******7766')
  })

  test('chave que é CPF usa a máscara de CPF', () => {
    // O caso que torna inútil mascarar um e não o outro: a chave Pix mais
    // comum no interior É o CPF.
    assert.equal(mascararChavePix('12345678901', 'CPF'), '123.***.***-01')
  })

  test('chave vazia continua vazia', () => {
    assert.equal(mascararChavePix('', 'CPF'), null)
    assert.equal(mascararChavePix(null, 'CPF'), null)
  })
})

describe('ocultarDoProdutor', () => {
  const produtor = {
    id: 'p1', nome: 'José', cpfCnpj: '12345678901',
    chavePix: 'jose@fazenda.com', tipoChavePix: 'EMAIL', conta: '123456',
  }

  test('mascara documento, chave e conta de uma vez', () => {
    const r = ocultarDoProdutor(produtor)
    assert.equal(r.cpfCnpj, '123.***.***-01')
    assert.equal(r.chavePix, 'jo**@fazenda.com')
    assert.notEqual(r.conta, '123456')
  })

  test('o que não é sigiloso passa intacto', () => {
    assert.equal(ocultarDoProdutor(produtor).nome, 'José')
  })

  test('mascara em vez de apagar', () => {
    // "Não posso ver" e "não existe" são coisas diferentes, e apagar o campo
    // faria a tela mostrar travessão nas duas.
    assert.ok(ocultarDoProdutor(produtor).cpfCnpj)
  })

  test('produtor sem CPF não vira máscara falsa', () => {
    assert.equal(ocultarDoProdutor({ nome: 'X', cpfCnpj: null }).cpfCnpj, null)
  })
})

describe('ocultarDaCarga', () => {
  const carga = {
    numeroTicket: 'PES-2026-01184',
    precoBaseKg: 4.85,
    produtor: { nome: 'José', cpfCnpj: '12345678901' },
    analise: { palitoPercentual: 34, precoAjustadoKg: 4.656, valorTotal: 33709.44 },
  }

  test('sem perfil de dinheiro, preço e valor NÃO vêm', () => {
    const r = ocultarDaCarga(carga, { veDinheiro: false })
    assert.equal('precoBaseKg' in r, false)
    assert.equal('precoAjustadoKg' in r.analise, false)
    assert.equal('valorTotal' in r.analise, false)
  })

  test('remove em vez de zerar', () => {
    // Zero é um número e soma. Ausência a tela já sabe tratar, porque carga
    // sem preço existe desde que o preço foi para a ordem.
    const r = ocultarDaCarga(carga, { veDinheiro: false })
    assert.notEqual(r.precoBaseKg, 0)
    assert.equal(r.precoBaseKg, undefined)
  })

  test('a qualidade continua visível para quem não vê dinheiro', () => {
    // Palito não é dado financeiro: o operador de balança precisa saber que a
    // carga foi analisada.
    assert.equal(ocultarDaCarga(carga, { veDinheiro: false }).analise.palitoPercentual, 34)
  })

  test('com perfil de dinheiro, os valores vêm inteiros', () => {
    const r = ocultarDaCarga(carga, { veDinheiro: true })
    assert.equal(r.precoBaseKg, 4.85)
    assert.equal(r.analise.valorTotal, 33709.44)
  })

  test('o CPF do produtor é mascarado para TODOS os perfis', () => {
    // Inclusive para o administrativo: quem precisa do número pede em
    // /sigilosos, e aí o pedido fica atribuído.
    assert.equal(ocultarDaCarga(carga, { veDinheiro: true }).produtor.cpfCnpj, '123.***.***-01')
  })

  test('não modifica a carga original', () => {
    ocultarDaCarga(carga, { veDinheiro: false })
    assert.equal(carga.precoBaseKg, 4.85)
    assert.equal(carga.analise.valorTotal, 33709.44)
  })
})
