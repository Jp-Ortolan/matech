// ---------------------------------------------------------------------------
// TESTE UNITÁRIO · numeração sequencial sob concorrência
// ---------------------------------------------------------------------------
// Cobre o RNF04 (uso simultâneo por múltiplos usuários) na parte em que ele é
// mais fácil de quebrar sem perceber: o número do ticket de pesagem.
//
// O CENÁRIO REAL: dois operadores de balança registram uma pesagem no mesmo
// instante. Os dois leem PES-2026-00007 como último ticket, os dois tentam
// gravar PES-2026-00008, e o segundo esbarra no índice único do PostgreSQL.
// Sem tratamento, esse operador recebe um 409 incompreensível e perde a
// pesagem — com o caminhão na balança esperando.
//
// Nenhum destes testes toca o banco. O "modelo" é um dublê que finge ser o
// prisma.carga e é programado para colidir quando o teste quiser — o que
// permite reproduzir de propósito uma corrida que, no banco de verdade, é
// rara e não dá para provocar sob demanda.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { criarComNumeroSequencial } = require('./cargas.service')

/** Erro no formato que o Prisma lança quando um campo único é violado. */
function erroDeDuplicidade(campo) {
  const erro = new Error('Unique constraint failed')
  erro.code = 'P2002'
  erro.meta = { target: [campo] }
  return erro
}

/**
 * Dublê do prisma.carga.
 * @param falhas quantas vezes seguidas o create deve colidir antes de aceitar
 * @param campoDaFalha em qual campo a colisão acontece
 */
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

/** Simula o "ler o maior e somar um": cada leitura devolve o próximo número. */
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
    // É exatamente o caso dos dois operadores ao mesmo tempo.
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
    // Insistir para sempre seria pior que falhar: prenderia a requisição e,
    // se a causa fosse outra, esconderia o problema de verdade.
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
    // Este é o teste que mais importa. Um CPF duplicado também é P2002, e
    // tentar de novo não conserta CPF nenhum — só esconderia do usuário o
    // erro que ele precisa ver, gastando três idas ao banco no caminho.
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
