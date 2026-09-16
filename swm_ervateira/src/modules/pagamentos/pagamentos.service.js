const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

function periodoDe(periodoInicio, periodoFim) {
  const inicio = new Date(periodoInicio)
  const fim = new Date(periodoFim)
  if (isNaN(inicio) || isNaN(fim)) throw new ErroDeNegocio('Período inválido', 400)
  if (inicio > fim) throw new ErroDeNegocio('A data inicial não pode ser maior que a final', 400)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

function montarDestino(produtor, destino) {
  const forma = destino?.formaPagamento || produtor.formaPagamento || 'PIX'
  const usa = (campo) => (destino && campo in destino ? destino[campo] : produtor[campo])

  const base = {
    formaPagamentoSnapshot: forma,
    titularSnapshot: vazioNulo(usa('titularConta')) ?? produtor.nome,
    chavePixSnapshot: null,
    tipoChavePixSnapshot: null,
    bancoSnapshot: null,
    agenciaSnapshot: null,
    contaSnapshot: null,
    tipoContaSnapshot: null,
  }

  if (forma === 'PIX') {
    base.chavePixSnapshot = vazioNulo(usa('chavePix'))
    base.tipoChavePixSnapshot = vazioNulo(usa('tipoChavePix'))
    if (!base.chavePixSnapshot) {
      throw new ErroDeNegocio(
        'Informe a chave Pix de destino',
        400,
        'A ordem é emitida para um destino concreto. Preencha a chave, ou troque a forma de pagamento.'
      )
    }
  } else if (forma === 'CONTA_BANCARIA') {
    base.bancoSnapshot = vazioNulo(usa('banco'))
    base.agenciaSnapshot = vazioNulo(usa('agencia'))
    base.contaSnapshot = vazioNulo(usa('conta'))
    base.tipoContaSnapshot = vazioNulo(usa('tipoConta'))
    if (!base.bancoSnapshot || !base.contaSnapshot) {
      throw new ErroDeNegocio(
        'Informe banco e conta de destino',
        400,
        'A ordem é emitida para um destino concreto. Preencha os dados bancários, ou troque a forma de pagamento.'
      )
    }
  }

  return base
}

const vazioNulo = (v) => (v === undefined || v === null || v === '' ? null : v)

const CAMPOS_DO_CADASTRO = [
  'formaPagamento', 'titularConta', 'chavePix', 'tipoChavePix',
  'banco', 'agencia', 'conta', 'tipoConta',
]

async function gerarOrdem({ produtorId, periodoInicio, periodoFim, precos, destino, atualizarCadastro }) {
  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)

  const { inicio, fim } = periodoDe(periodoInicio, periodoFim)

  const produtor = await prisma.produtor.findUnique({ where: { id: produtorId } })
  if (!produtor) throw new ErroDeNegocio('Produtor não encontrado', 404)

  const cargas = await cargasElegiveis(produtorId, inicio, fim)
  if (cargas.length === 0) {
    throw new ErroDeNegocio(
      'Nenhuma carga analisada e em aberto neste período',
      400,
      'Só entram cargas com análise lançada e que ainda não estejam em outra ordem. Confira se as pesagens do período já passaram pelo laboratório.'
    )
  }

  const itens = montarItens(cargas, mapearPrecos(precos))

  const destinoDaOrdem = montarDestino(produtor, destino)

  const valorTotal = Number(itens.reduce((soma, i) => soma + i.valor, 0).toFixed(2))

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
            ...destinoDaOrdem,
            itens: {
              create: itens.map(({ cargaId, pesoLiquidoKg, precoKg, valor }) => ({
                cargaId, pesoLiquidoKg, precoKg, valor,
              })),
            },
          },
          include: {
            itens: { include: { carga: { select: { numeroTicket: true, dataHora: true, tipoMateriaPrima: true } } } },
            produtor: { select: { nome: true, cpfCnpj: true, municipio: true, uf: true } },
          },
        }),
        ...itens.map((i) =>
          prisma.carga.update({
            where: { id: i.cargaId },
            data: { situacao: 'EM_ORDEM_PAGAMENTO', precoBaseKg: i.precoBaseKg },
          })
        ),
        ...itens.map((i) =>
          prisma.analiseQualidade.update({
            where: { id: i.analiseId },
            data: { precoAjustadoKg: i.precoKg, valorTotal: i.valor },
          })
        ),
      ])

      if (atualizarCadastro && destino) {
        try {
          await sincronizarCadastro(produtorId, destino)
        } catch (e) {
          console.error('[pagamentos] ordem emitida, mas o cadastro não pôde ser atualizado:', e.message)
        }
      }

      return ordem
    } catch (erro) {
      const colidiuNoNumero =
        erro.code === 'P2002' &&
        (erro.meta?.target ?? []).some((alvo) => String(alvo).includes('numero'))

      if (!colidiuNoNumero || tentativa === MAXIMO_DE_TENTATIVAS) throw erro
    }
  }
}

async function cargasElegiveis(produtorId, inicio, fim) {
  return prisma.carga.findMany({
    where: {
      produtorId,
      situacao: 'ANALISADA',
      dataHora: { gte: inicio, lte: fim },
      itemOrdem: null,
    },
    orderBy: { dataHora: 'asc' },
    include: { analise: true, erval: { select: { identificacao: true } } },
  })
}

function mapearPrecos(precos) {
  const mapa = new Map()
  for (const item of precos ?? []) {
    if (!item || !item.cargaId) continue
    const preco = Number(item.precoKg)
    if (!Number.isFinite(preco) || !(preco > 0)) {
      throw new ErroDeNegocio('O preço por quilo deve ser maior que zero', 400)
    }
    mapa.set(item.cargaId, Number(preco.toFixed(4)))
  }
  return mapa
}

function montarItens(cargas, precoPorCarga) {
  return cargas.map((c) => {
    const precoKg = precoPorCarga.get(c.id)
    if (precoKg == null) {
      throw new ErroDeNegocio(
        `Informe o preço da carga ${c.numeroTicket}`,
        400,
        'Toda carga da ordem precisa de preço por quilo — é ele que define o valor final.'
      )
    }

    const valor = Number((Number(c.pesoLiquidoKg) * precoKg).toFixed(2))

    return {
      cargaId: c.id,
      analiseId: c.analise.id,
      pesoLiquidoKg: c.pesoLiquidoKg,
      precoBaseKg: precoKg,
      precoKg,
      valor,
    }
  })
}

async function previaDaOrdem({ produtorId, periodoInicio, periodoFim }) {
  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)
  const { inicio, fim } = periodoDe(periodoInicio, periodoFim)

  const cargas = await cargasElegiveis(produtorId, inicio, fim)

  let motivo = null
  if (cargas.length === 0) {
    const [aguardando, jaEmOrdem, reprovadas] = await Promise.all([
      prisma.carga.count({ where: { produtorId, situacao: 'AGUARDANDO_ANALISE', dataHora: { gte: inicio, lte: fim } } }),
      prisma.carga.count({ where: { produtorId, dataHora: { gte: inicio, lte: fim }, itemOrdem: { isNot: null } } }),
      prisma.carga.count({ where: { produtorId, situacao: 'REPROVADA', dataHora: { gte: inicio, lte: fim } } }),
    ])

    if (aguardando > 0) {
      motivo = `${aguardando} ${aguardando === 1 ? 'carga aguarda' : 'cargas aguardam'} a análise do laboratório. Só entram na ordem depois de analisadas.`
    } else if (jaEmOrdem > 0) {
      motivo = `As ${jaEmOrdem} ${jaEmOrdem === 1 ? 'carga do período já está' : 'cargas do período já estão'} em outra ordem de pagamento.`
    } else if (reprovadas > 0) {
      motivo = `${reprovadas} ${reprovadas === 1 ? 'carga foi reprovada' : 'cargas foram reprovadas'} na análise. Carga reprovada não gera pagamento.`
    } else {
      motivo = 'Nenhuma carga registrada para este produtor no período.'
    }
  }

  return {
    total: cargas.length,
    motivo,
    cargas: cargas.map((c) => ({
      id: c.id,
      numeroTicket: c.numeroTicket,
      dataHora: c.dataHora,
      tipoMateriaPrima: c.tipoMateriaPrima,
      erval: c.erval?.identificacao ?? null,
      pesoLiquidoKg: c.pesoLiquidoKg,
      precoSugeridoKg: c.precoBaseKg,
      palitoPercentual: c.analise.palitoPercentual,
    })),
  }
}

async function sincronizarCadastro(produtorId, destino) {
  const dados = {}
  for (const campo of CAMPOS_DO_CADASTRO) {
    if (destino && campo in destino) dados[campo] = vazioNulo(destino[campo])
  }
  if (Object.keys(dados).length === 0) return
  await prisma.produtor.update({ where: { id: produtorId }, data: dados })
}

async function aguardandoOrdem() {
  const cargas = await prisma.carga.findMany({
    where: { situacao: 'ANALISADA', itemOrdem: null },
    orderBy: { dataHora: 'asc' },
    include: {
      analise: true,
      erval: { select: { identificacao: true } },
      produtor: {
        select: {
          id: true, nome: true, cpfCnpj: true, municipio: true, uf: true,
          formaPagamento: true, titularConta: true, chavePix: true, tipoChavePix: true,
          banco: true, agencia: true, conta: true, tipoConta: true,
        },
      },
    },
  })

  const porProdutor = new Map()
  for (const c of cargas) {
    const p = c.produtor
    if (!porProdutor.has(p.id)) porProdutor.set(p.id, { produtor: p, cargas: [], pesoTotal: 0, valorSugerido: 0 })
    const grupo = porProdutor.get(p.id)

    const peso = Number(c.pesoLiquidoKg)
    const preco = c.precoBaseKg === null ? null : Number(c.precoBaseKg)

    grupo.cargas.push({
      id: c.id,
      numeroTicket: c.numeroTicket,
      dataHora: c.dataHora,
      tipoMateriaPrima: c.tipoMateriaPrima,
      erval: c.erval?.identificacao ?? null,
      pesoLiquidoKg: peso,
      precoSugeridoKg: preco,
      palitoPercentual: c.analise?.palitoPercentual ?? null,
    })
    grupo.pesoTotal += peso
    grupo.valorSugerido += preco === null ? 0 : peso * preco
  }

  const produtores = [...porProdutor.values()]
    .map((g) => ({
      ...g,
      pesoTotal: Number(g.pesoTotal.toFixed(2)),
      valorSugerido: Number(g.valorSugerido.toFixed(2)),
      maisAntiga: g.cargas[0]?.dataHora ?? null,
    }))
    .sort((a, b) => new Date(a.maisAntiga) - new Date(b.maisAntiga))

  return {
    totalCargas: cargas.length,
    totalProdutores: produtores.length,
    pesoTotal: Number(produtores.reduce((s, p) => s + p.pesoTotal, 0).toFixed(2)),
    valorSugerido: Number(produtores.reduce((s, p) => s + p.valorSugerido, 0).toFixed(2)),
    produtores,
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
      produtor: { select: { nome: true, cpfCnpj: true, municipio: true, uf: true } },
      itens: { include: { carga: { select: { numeroTicket: true, dataHora: true, tipoMateriaPrima: true } } } },
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

module.exports = {
  gerarOrdem, previaDaOrdem, aguardandoOrdem, confirmarPagamento, listar,
  mapearPrecos, montarItens, montarDestino, periodoDe,
}
