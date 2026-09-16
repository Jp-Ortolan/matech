const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const servico = require('./usuarios.service')

describe('normalizarLogin', () => {
  test('baixa a caixa e tira espaço das pontas', () => {
    assert.equal(servico.normalizarLogin('  Admin.MATECH '), 'admin.matech')
  })

  test('recusa login curto demais', () => {
    assert.throws(() => servico.normalizarLogin('ab'), /3 caracteres/)
  })

  test('recusa caractere que não é letra, número, ponto, hífen ou sublinhado', () => {
    assert.throws(() => servico.normalizarLogin('joão silva'), /apenas letras/)
    assert.throws(() => servico.normalizarLogin('admin@matech'), /apenas letras/)
  })

  test('aceita os separadores previstos', () => {
    assert.equal(servico.normalizarLogin('rogerio.anselmo'), 'rogerio.anselmo')
    assert.equal(servico.normalizarLogin('joao_pedro-2'), 'joao_pedro-2')
  })
})

describe('validarPerfil', () => {
  test('aceita os cinco perfis do sistema', () => {
    for (const p of ['OPERADOR_BALANCA', 'ANALISTA_QUALIDADE', 'COMPRADOR_AVALIADOR',
                     'ADMINISTRATIVO', 'ADMINISTRADOR']) {
      assert.doesNotThrow(() => servico.validarPerfil(p), p)
    }
  })

  test('recusa perfil inventado', () => {
    assert.throws(() => servico.validarPerfil('GERENTE'), /Perfil inválido/)
  })
})

describe('validarSenha', () => {
  test('exige o mínimo de caracteres', () => {
    assert.throws(() => servico.validarSenha('12345'), /6 caracteres/)
    assert.throws(() => servico.validarSenha(''), /6 caracteres/)
    assert.doesNotThrow(() => servico.validarSenha('matech123'))
  })
})

describe('atualizar · travas de autoproteção', () => {
  test('o administrador não desativa a própria conta', async () => {
    await assert.rejects(
      () => servico.atualizar('u1', { ativo: false }, 'u1'),
      /não pode desativar a própria conta/
    )
  })

  test('o administrador não retira o próprio perfil', async () => {
    await assert.rejects(
      () => servico.atualizar('u1', { perfil: 'OPERADOR_BALANCA' }, 'u1'),
      /não pode retirar o próprio perfil/
    )
  })

  test('recusa requisição sem nada para atualizar', async () => {
    await assert.rejects(() => servico.atualizar('u1', {}, 'u1'), /Nada a atualizar/)
  })
})
