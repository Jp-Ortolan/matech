// ---------------------------------------------------------------------------
// SERVIÇO · ordens de pagamento  (RF11)
// ---------------------------------------------------------------------------
// Uma ordem agrupa todas as cargas ANALISADAS de um produtor num período.
// O valor de cada carga já foi calculado na análise, então aqui é só somar —
// a conta não se repete, o que evita divergência entre a tela de análise e a
// ordem emitida.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

async function gerarOrdem({ produtorId, periodoInicio, periodoFim }) {
  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)

  const inicio = new Date(periodoInicio)
  const fim = new Date(periodoFim)
  if (isNaN(inicio) || isNaN(fim)) throw new ErroDeNegocio('Período inválido', 400)
  if (inicio > fim) throw new ErroDeNegocio('A data inicial não pode ser maior que a final', 400)

  const produtor = await prisma.produtor.findUnique({ where: { id: produtorId } })
  if (!produtor) throw new ErroDeNegocio('Produtor não encontrado', 404)

  // Só entram cargas analisadas e que ainda não estejam em outra ordem.
  const cargas = await prisma.carga.findMany({
    where: {
      produtorId,
      situacao: 'ANALISADA',
      dataHora: { gte: inicio, lte: fim },
      itemOrdem: null,
    },
    include: { analise: true },
  })

  if (cargas.length === 0) {
    throw new ErroDeNegocio('Nenhuma carga analisada e em aberto neste período', 400)
  }

  const itens = cargas.map(c => ({
    cargaId: c.id,
    pesoLiquidoKg: c.pesoLiquidoKg,
    precoKg: c.analise.precoAjustadoKg,
    valor: c.analise.valorTotal,
  }))
  const valorTotal = itens.reduce((soma, i) => soma + Number(i.valor), 0)

  // A numeração da ordem sofre da mesma corrida do ticket de pesagem: ler o
  // maior e somar um deixa uma janela entre a leitura e a gravação. Aqui a
  // colisão é bem menos provável — ordens são emitidas por uma pessoa, no
  // administrativo, e não por quatro operadores ao mesmo tempo —, mas o custo
  // dela seria alto: a emissão falharia com um erro incompreensível depois de
  // o usuário já ter escolhido produtor e período.
  //
  // Repare que a transação continua fazendo o trabalho dela: criar a ordem e
  // marcar as cargas acontecem juntas ou não acontecem. A tentativa extra
  // envolve a transação inteira, e não parte dela — uma colisão desfaz tudo e
  // refaz com o número seguinte, nunca deixando ordem criada sem carga marcada.
  const MAXIMO_DE_TENTATIVAS = 3

  for (let tentativa = 1; tentativa <= MAXIMO_DE_TENTATIVAS; tentativa++) {
    try {
      const numero = await gerarNumeroOrdem()

      const [ordem] = await prisma.$transaction([
        prisma.ordemPagamento.create({
          data: {
            numero,
            produtorId,
            periodoInicio: inicio,
            periodoFim: fim,
            valorTotal,
            // Cópia da chave no momento da emissão: se o produtor trocar de
            // chave depois, a ordem antiga continua mostrando para onde o
            // dinheiro foi.
            chavePixSnapshot: produtor.chavePix,
            itens: { create: itens },
          },
          include: { itens: true, produtor: { select: { nome: true, cpfCnpj: true, chavePix: true } } },
        }),
        prisma.carga.updateMany({
          where: { id: { in: cargas.map(c => c.id) } },
          data: { situacao: 'EM_ORDEM_PAGAMENTO' },
        }),
      ])

      return ordem
    } catch (erro) {
      const colidiuNoNumero =
        erro.code === 'P2002' &&
        (erro.meta?.target ?? []).some((alvo) => String(alvo).includes('numero'))

      if (!colidiuNoNumero || tentativa === MAXIMO_DE_TENTATIVAS) throw erro
    }
  }
}

async function confirmarPagamento(ordemId) {
  const ordem = await prisma.ordemPagamento.findUnique({
    where: { id: ordemId },
    include: { itens: true },
  })
  if (!ordem) throw new ErroDeNegocio('Ordem não encontrada', 404)
  if (ordem.situacao === 'PAGA') throw new ErroDeNegocio('Esta ordem já foi paga', 409)

  const [atualizada] = await prisma.$transaction([
    prisma.ordemPagamento.update({
      where: { id: ordemId },
      data: { situacao: 'PAGA', pagaEm: new Date() },
    }),
    prisma.carga.updateMany({
      where: { id: { in: ordem.itens.map(i => i.cargaId) } },
      data: { situacao: 'PAGA' },
    }),
  ])

  return atualizada
}

async function listar({ produtorId, situacao }) {
  const where = {}
  if (produtorId) where.produtorId = produtorId
  if (situacao) where.situacao = situacao

  const ordens = await prisma.ordemPagamento.findMany({
    where,
    orderBy: { emitidaEm: 'desc' },
    include: {
      produtor: { select: { nome: true, cpfCnpj: true } },
      _count: { select: { itens: true } },
    },
  })

  const emAberto = ordens
    .filter(o => o.situacao === 'PENDENTE')
    .reduce((s, o) => s + Number(o.valorTotal), 0)

  return { total: ordens.length, totalEmAberto: Number(emAberto.toFixed(2)), ordens }
}

async function gerarNumeroOrdem() {
  const ano = new Date().getFullYear()
  const prefixo = `OP-${ano}-`
  const ultima = await prisma.ordemPagamento.findFirst({
    where: { numero: { startsWith: prefixo } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const proximo = ultima ? Number(ultima.numero.slice(prefixo.length)) + 1 : 1
  return prefixo + String(proximo).padStart(4, '0')
}

module.exports = { gerarOrdem, confirmarPagamento, listar }
