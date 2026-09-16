const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { criarComNumeroSequencial } = require('./cargas.service')

function erroDeDuplicidade(campo) {
  const erro = new Error('Unique constraint failed')
  erro.code = 'P2002'
  erro.meta = { target: [campo] }
  return erro
}

function modeloFalso({ falhas = 0, campoDaFalha = 'numeroTicket' } = {}) {
  const estado = { chamadas: [], restantes: falhas }

  return {
    estado,
    async create({ data }) {
      estado.chamadas.push(data.numeroTicket)
      if (estado.restantes > 0) {
        estado.restantes--
        throw erroDeDuplicidade(campoDaFalha)
      }
      return { id: 'carga-1', ...data }
    },
  }
}

function numerador(inicio = 8) {
  let atual = inicio
  return async () => `PES-2026-${String(atual++).padStart(5, '0')}`
}

describe('criarComNumeroSequencial', () => {
  test('sem colisão, grava na primeira tentativa', async () => {
    const modelo = modeloFalso()

    const criada = await criarComNumeroSequencial({
      modelo,
      campo: 'numeroTicket',
      proximoNumero: numerador(),
      dados: { produtorId: 'p1' },
    })

    assert.equal(criada.numeroTicket, 'PES-2026-00008')
    assert.equal(modelo.estado.chamadas.length, 1)
  })

  test('colidiu uma vez: tenta o número seguinte e grava', async () => {
    const modelo = modeloFalso({ falhas: 1 })

    const criada = await criarComNumeroSequencial({
      modelo,
      campo: 'numeroTicket',
      proximoNumero: numerador(),
      dados: { produtorId: 'p1' },
    })

    assert.equal(modelo.estado.chamadas.length, 2)
    assert.deepEqual(modelo.estado.chamadas, ['PES-2026-00008', 'PES-2026-00009'])
    assert.equal(criada.numeroTicket, 'PES-2026-00009')
  })

  test('colidiu duas vezes: ainda assim grava', async () => {
    const modelo = modeloFalso({ falhas: 2 })

    const criada = await criarComNumeroSequencial({
      modelo,
      campo: 'numeroTicket',
      proximoNumero: numerador(),
      dados: {},
    })

    assert.equal(modelo.estado.chamadas.length, 3)
    assert.equal(criada.numeroTicket, 'PES-2026-00010')
  })

  test('colidindo sempre, desiste e propaga o erro', async () => {
    const modelo = modeloFalso({ falhas: 99 })

    await assert.rejects(
      () => criarComNumeroSequencial({
        modelo,
        campo: 'numeroTicket',
        proximoNumero: numerador(),
        dados: {},
      }),
      (erro) => erro.code === 'P2002',
    )

    assert.equal(modelo.estado.chamadas.length, 3, 'deve parar em três tentativas')
  })

  test('duplicidade em OUTRO campo sobe na hora, sem retentar', async () => {
    const modelo = modeloFalso({ falhas: 99, campoDaFalha: 'cpfCnpj' })

    await assert.rejects(
      () => criarComNumeroSequencial({
        modelo,
        campo: 'numeroTicket',
        proximoNumero: numerador(),
        dados: {},
      }),
      (erro) => erro.code === 'P2002',
    )

    assert.equal(modelo.estado.chamadas.length, 1, 'não deve retentar')
  })

  test('erro que não é de unicidade sobe na hora', async () => {
    const modelo = {
      estado: { chamadas: [] },
      async create() {
        this.estado.chamadas.push(1)
        throw new Error('conexão com o banco caiu')
      },
    }

    await assert.rejects(
      () => criarComNumeroSequencial({
        modelo,
        campo: 'numeroTicket',
        proximoNumero: numerador(),
        dados: {},
      }),
      /conexão com o banco caiu/,
    )

    assert.equal(modelo.estado.chamadas.length, 1)
  })
})
