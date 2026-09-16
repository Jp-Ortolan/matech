const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { LIMITES, erroDeTamanho } = require('./textos')

describe('erroDeTamanho', () => {
  test('deixa passar um cadastro normal', () => {
    assert.equal(
      erroDeTamanho({
        nome: 'José Antônio da Silva Sant Anna',
        telefone: '(42) 99999-9999',
        municipio: 'Prudentópolis',
        chavePix: 'jose.antonio@provedor.com.br',
      }),
      null,
    )
  })

  test('o limite EXATO passa — o erro é passar dele, não alcançá-lo', () => {
    assert.equal(erroDeTamanho({ nome: 'a'.repeat(LIMITES.nome) }), null)
  })

  test('um caractere além recusa, e a mensagem diz o rótulo da tela', () => {
    const erro = erroDeTamanho({ nome: 'a'.repeat(LIMITES.nome + 1) })
    assert.match(erro, /o nome/)
    assert.match(erro, new RegExp(String(LIMITES.nome)))
  })

  test('não julga campo que não veio — é o caso do PUT parcial', () => {
    assert.equal(erroDeTamanho({ telefone: '4299999999' }), null)
  })

  test('nulo não é texto longo', () => {
    assert.equal(erroDeTamanho({ nome: null, chavePix: undefined }), null)
  })

  test('ignora campo que não está na lista', () => {
    assert.equal(erroDeTamanho({ uf: 'PARANA', cpfCnpj: '9'.repeat(50) }), null)
  })

  test('a chave Pix respeita o teto de 77 do Banco Central', () => {
    assert.equal(LIMITES.chavePix, 77)
    assert.equal(erroDeTamanho({ chavePix: 'a'.repeat(78) }) !== null, true)
  })
})
