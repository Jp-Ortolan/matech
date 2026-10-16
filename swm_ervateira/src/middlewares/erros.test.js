const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

const { ErroDeNegocio, traduzirErro, tratarErros } = require('./erros')

// Monta uma API mínima que lança o erro pedido, para ver a resposta real.
async function responder(lancar, corpo = '{}') {
  const app = express()
  app.use(express.json({ limit: '1kb' }))
  app.post('/', () => { throw lancar() })
  app.use(tratarErros)
  const servidor = app.listen(0)
  const porta = servidor.address().port
  try {
    const r = await fetch(`http://localhost:${porta}/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo,
    })
    return { status: r.status, corpo: await r.json() }
  } finally {
    servidor.close()
  }
}

function erroPrisma(code, meta) {
  return Object.assign(new Error('falha'), { code, meta })
}

describe('tratarErros', () => {
  test('JSON malformado vira 400 com explicação', async () => {
    const r = await responder(() => new Error('não chega aqui'), '{"nome": ')
    assert.equal(r.status, 400)
    assert.match(r.corpo.erro, /JSON/)
  })

  test('corpo grande demais vira 413', async () => {
    const r = await responder(() => new Error('não chega aqui'), JSON.stringify({ t: 'a'.repeat(5000) }))
    assert.equal(r.status, 413)
  })

  test('erro de negócio mantém status e mensagem', async () => {
    const r = await responder(() => new ErroDeNegocio('Informe a tara', 400, 'Peso do caminhão vazio.'))
    assert.deepEqual(r, { status: 400, corpo: { erro: 'Informe a tara', detalhe: 'Peso do caminhão vazio.' } })
  })

  test('erro inesperado vira 500 com código para achar no log', async () => {
    const original = console.error
    console.error = () => {}
    try {
      const r = await responder(() => new TypeError('x is undefined'))
      assert.equal(r.status, 500)
      assert.match(r.corpo.codigo, /^[0-9a-f]{8}$/)
      assert.ok(r.corpo.detalhe.includes(r.corpo.codigo))
      assert.ok(!JSON.stringify(r.corpo).includes('x is undefined'))  // não vaza detalhe interno
    } finally {
      console.error = original
    }
  })
})

describe('traduzirErro · Prisma', () => {
  test('número fora do tamanho da coluna (P2020) vira 400', () => {
    assert.equal(traduzirErro(erroPrisma('P2020')).status, 400)
  })
  test('texto longo demais (P2000) vira 400', () => {
    assert.equal(traduzirErro(erroPrisma('P2000')).status, 400)
  })
  test('id ou data em formato inválido (P2007/P2023) vira 400', () => {
    assert.equal(traduzirErro(erroPrisma('P2007')).status, 400)
    assert.equal(traduzirErro(erroPrisma('P2023')).status, 400)
  })
  test('valor fora da lista aponta o campo', () => {
    const e = new Error('Invalid value for argument `tipoMateriaPrima`. Expected TipoMateriaPrima.')
    e.name = 'PrismaClientValidationError'
    const r = traduzirErro(e)
    assert.equal(r.status, 400)
    assert.ok(r.detalhe.includes('tipoMateriaPrima'))
  })
  test('duplicado continua 409 e não encontrado continua 404', () => {
    assert.equal(traduzirErro(erroPrisma('P2002', { target: ['cpf'] })).status, 409)
    assert.equal(traduzirErro(erroPrisma('P2025')).status, 404)
  })
  test('erro desconhecido devolve null', () => {
    assert.equal(traduzirErro(new Error('qualquer')), null)
  })
})
