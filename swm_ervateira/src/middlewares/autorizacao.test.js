// ---------------------------------------------------------------------------
// TESTE UNITÁRIO · autorização por perfil
// ---------------------------------------------------------------------------
// Cobre o RF15 e o RNF04, conforme o Quadro 8: "Unitários · funções e regras
// de negócio isoladas".
//
// POR QUE ESTE TESTE EXISTE: a chegada do perfil ADMINISTRADOR mexeu no
// middleware que decide TODAS as autorizações do sistema. Uma regressão aqui
// não quebraria nada de forma visível — ela abriria uma porta em silêncio, ou
// fecharia uma que estava aberta, e ninguém perceberia até alguém reclamar
// que não consegue mais pesar. Os dois primeiros blocos abaixo são a garantia
// escrita de que os quatro perfis antigos continuam podendo exatamente o que
// podiam antes.
//
// Nenhum teste toca o banco nem sobe o servidor: um middleware do Express é
// só uma função de três argumentos, e dá para chamá-la com dublês.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { permitir, apenas, podeNegocio, PERFIS, IRRESTRITOS } = require('./autorizacao')

/** Dublê de req/res/next: registra o que o middleware fez, sem Express. */
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
  // A tabela abaixo é o comportamento de antes do perfil ADMINISTRADOR
  // existir, escrito à mão a partir das rotas de cada módulo. Se alguma
  // linha passar a falhar, uma permissão existente foi alterada.
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
    // É esta linha que distingue apenas() de permitir(). Se ela falhar, o
    // acréscimo automático de perfil vazou para a administração de contas.
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
    // Esta é a trava contra a segunda lógica de autorização: se algum dia
    // podeNegocio e permitir discordarem, a tela vai omitir uma coisa e a
    // rota vai liberar outra — e ninguém percebe até alguém ver o que não
    // devia. Aqui as duas são comparadas perfil a perfil.
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
