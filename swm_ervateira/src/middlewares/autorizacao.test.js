const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { permitir, apenas, podeNegocio, PERFIS, IRRESTRITOS } = require('./autorizacao')

function executar(middleware, perfil) {
  const req = perfil ? { usuario: { id: 'u1', perfil } } : {}
  const resultado = { status: null, corpo: null, passou: false }
  const res = {
    status(codigo) { resultado.status = codigo; return this },
    json(corpo) { resultado.corpo = corpo; return this },
  }
  middleware(req, res, () => { resultado.passou = true })
  return resultado
}

describe('permitir · operações de negócio', () => {
  test('deixa passar o perfil listado na rota', () => {
    assert.equal(executar(permitir('OPERADOR_BALANCA'), 'OPERADOR_BALANCA').passou, true)
    assert.equal(executar(permitir('ANALISTA_QUALIDADE'), 'ANALISTA_QUALIDADE').passou, true)
  })

  test('barra com 403 o perfil que não está na rota', () => {
    const r = executar(permitir('OPERADOR_BALANCA'), 'ANALISTA_QUALIDADE')
    assert.equal(r.passou, false)
    assert.equal(r.status, 403)
  })

  test('os perfis irrestritos passam sem estar listados', () => {
    for (const perfil of IRRESTRITOS) {
      assert.equal(executar(permitir('OPERADOR_BALANCA'), perfil).passou, true, perfil)
      assert.equal(executar(permitir('ANALISTA_QUALIDADE'), perfil).passou, true, perfil)
      assert.equal(executar(permitir('COMPRADOR_AVALIADOR'), perfil).passou, true, perfil)
    }
  })

  test('exige autenticação antes: sem req.usuario é 401, não 403', () => {
    const r = executar(permitir('OPERADOR_BALANCA'), null)
    assert.equal(r.passou, false)
    assert.equal(r.status, 401)
  })
})

describe('permitir · nenhuma permissão antiga mudou', () => {
  const COMO_ERA = [
    ['POST /api/cargas', ['OPERADOR_BALANCA'], ['OPERADOR_BALANCA', 'ADMINISTRATIVO']],
    ['POST /api/qualidade/cargas/:id', ['ANALISTA_QUALIDADE'], ['ANALISTA_QUALIDADE', 'ADMINISTRATIVO']],
    ['POST /api/produtores', ['COMPRADOR_AVALIADOR'], ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO']],
    ['POST /api/sincronizacao', ['COMPRADOR_AVALIADOR'], ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO']],
    ['POST /api/pagamentos', [], ['ADMINISTRATIVO']],
  ]

  const ANTIGOS = PERFIS.filter((p) => p !== 'ADMINISTRADOR')

  for (const [rota, listados, deviamPassar] of COMO_ERA) {
    test(rota, () => {
      const middleware = permitir(...listados)
      for (const perfil of ANTIGOS) {
        const esperado = deviamPassar.includes(perfil)
        assert.equal(
          executar(middleware, perfil).passou, esperado,
          `${perfil} em ${rota} deveria ${esperado ? 'passar' : 'ser barrado'}`
        )
      }
    })
  }
})

describe('apenas · administração de contas', () => {
  test('só o administrador entra', () => {
    assert.equal(executar(apenas('ADMINISTRADOR'), 'ADMINISTRADOR').passou, true)
  })

  test('o administrativo NÃO entra, apesar de ser irrestrito no negócio', () => {
    const r = executar(apenas('ADMINISTRADOR'), 'ADMINISTRATIVO')
    assert.equal(r.passou, false)
    assert.equal(r.status, 403)
  })

  test('nenhum perfil de operação entra', () => {
    for (const perfil of ['OPERADOR_BALANCA', 'ANALISTA_QUALIDADE', 'COMPRADOR_AVALIADOR']) {
      assert.equal(executar(apenas('ADMINISTRADOR'), perfil).passou, false, perfil)
    }
  })
})

describe('podeNegocio · a mesma decisão, sem HTTP', () => {
  test('responde igual ao permitir() para todos os perfis', () => {
    for (const alvo of ['OPERADOR_BALANCA', 'ANALISTA_QUALIDADE', 'COMPRADOR_AVALIADOR', 'ADMINISTRATIVO']) {
      for (const perfil of PERFIS) {
        assert.equal(
          podeNegocio(perfil, alvo),
          executar(permitir(alvo), perfil).passou,
          `${perfil} em permitir('${alvo}')`
        )
      }
    }
  })

  test('o administrativo e o administrador veem dinheiro', () => {
    assert.equal(podeNegocio('ADMINISTRATIVO', 'ADMINISTRATIVO'), true)
    assert.equal(podeNegocio('ADMINISTRADOR', 'ADMINISTRATIVO'), true)
  })

  test('balança, qualidade e campo não veem dinheiro', () => {
    for (const perfil of ['OPERADOR_BALANCA', 'ANALISTA_QUALIDADE', 'COMPRADOR_AVALIADOR']) {
      assert.equal(podeNegocio(perfil, 'ADMINISTRATIVO'), false, perfil)
    }
  })
})
