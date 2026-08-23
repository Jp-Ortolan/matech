// ---------------------------------------------------------------------------
// TESTE UNITÁRIO · validação de CPF e CNPJ
// ---------------------------------------------------------------------------
// O que se testa aqui não é a matemática do dígito verificador — é o caso de
// uso real: o operador de balança digita o documento do produtor com o
// caminhão esperando, troca dois algarismos, e a ordem de pagamento sai para
// um documento que não é dele. O teste da inversão é o que mais importa.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { cpfValido, cnpjValido, erroNoDocumento, formatarDocumento } = require('./documentos')

describe('CPF', () => {
  test('aceita CPFs válidos, com ou sem pontuação', () => {
    for (const cpf of ['529.982.247-25', '52998224725', '111.444.777-35']) {
      assert.equal(cpfValido(cpf), true, `${cpf} deveria ser válido`)
    }
  })

  test('recusa dois algarismos invertidos', () => {
    // 529.982.247-25 com o 5 e o 2 do começo trocados. É o erro de digitação
    // mais comum, e o dígito verificador existe justamente para pegá-lo.
    assert.equal(cpfValido('259982247-25'), false)
  })

  test('recusa todos os dígitos iguais', () => {
    // Passam na conta, mas não são CPF de ninguém — e é o que sai quando
    // alguém segura uma tecla para "preencher e resolver depois".
    for (const cpf of ['11111111111', '00000000000', '99999999999']) {
      assert.equal(cpfValido(cpf), false, `${cpf} não deveria passar`)
    }
  })

  test('recusa comprimento errado', () => {
    assert.equal(cpfValido('5299822472'), false)
    assert.equal(cpfValido('529982247251'), false)
  })
})

describe('CNPJ', () => {
  test('aceita CNPJs válidos', () => {
    for (const cnpj of ['11.222.333/0001-81', '11222333000181']) {
      assert.equal(cnpjValido(cnpj), true, `${cnpj} deveria ser válido`)
    }
  })

  test('recusa dígito verificador errado', () => {
    assert.equal(cnpjValido('11222333000182'), false)
  })

  test('recusa todos iguais', () => {
    assert.equal(cnpjValido('11111111111111'), false)
  })
})

describe('erroNoDocumento', () => {
  test('documento bom não gera mensagem', () => {
    assert.equal(erroNoDocumento('529.982.247-25'), null)
    assert.equal(erroNoDocumento('11.222.333/0001-81'), null)
  })

  test('vazio pede o documento', () => {
    assert.match(erroNoDocumento(''), /Informe/)
  })

  test('a mensagem diz quantos dígitos foram digitados', () => {
    // "Documento inválido" não ajuda ninguém a consertar. Dizer que faltou um
    // dígito, e quantos vieram, ajuda.
    assert.match(erroNoDocumento('5299822472'), /10/)
  })

  test('a mensagem distingue CPF de CNPJ', () => {
    assert.match(erroNoDocumento('52998224726'), /CPF/)
    assert.match(erroNoDocumento('11222333000182'), /CNPJ/)
  })
})

describe('formatarDocumento', () => {
  test('põe a pontuação de CPF e de CNPJ', () => {
    assert.equal(formatarDocumento('52998224725'), '529.982.247-25')
    assert.equal(formatarDocumento('11222333000181'), '11.222.333/0001-81')
  })

  test('devolve inalterado o que não tem tamanho de documento', () => {
    assert.equal(formatarDocumento('123'), '123')
  })
})
