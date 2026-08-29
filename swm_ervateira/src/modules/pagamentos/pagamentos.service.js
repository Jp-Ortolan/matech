// ---------------------------------------------------------------------------
// SERVIÇO · ordens de pagamento  (RF11)
// ---------------------------------------------------------------------------
// Uma ordem agrupa todas as cargas ANALISADAS de um produtor num período.
//
// É AQUI QUE O PREÇO ENTRA NO SISTEMA. A balança pesa, o laboratório mede a
// qualidade e registra o desconto em pontos percentuais — e só então o
// administrativo, que é quem negocia com o produtor, informa por quanto cada
// carga foi acordada. O valor final nasce deste encontro: o preço que ele
// informa, menos o desconto que o laboratório já mediu.
//
// Duas etapas, e a primeira existe para a segunda não ser às cegas:
//   previaDaOrdem() → mostra as cargas elegíveis, com peso e desconto
//   gerarOrdem()    → recebe o preço de cada uma e emite

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

/**
 * Normaliza e valida o período. Usado pela prévia e pela emissão, para que as
 * duas recortem exatamente o mesmo intervalo.
 *
 * O fim vai até o último instante do dia: quem digita "até 31/08" quer as
 * cargas do dia 31, e `new Date('2026-08-31')` é meia-noite — o que deixaria
 * o dia inteiro de fora.
 */
function periodoDe(periodoInicio, periodoFim) {
  const inicio = new Date(periodoInicio)
  const fim = new Date(periodoFim)
  if (isNaN(inicio) || isNaN(fim)) throw new ErroDeNegocio('Período inválido', 400)
  if (inicio > fim) throw new ErroDeNegocio('A data inicial não pode ser maior que a final', 400)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

async function gerarOrdem({ produtorId, periodoInicio, periodoFim, precos }) {
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

  // É AQUI QUE O PREÇO ENTRA. A conta está em montarItens, mais abaixo, fora
  // da transação e sem banco — para poder ser testada isoladamente.
  const itens = montarItens(cargas, mapearPrecos(precos))

  const valorTotal = Number(itens.reduce((soma, i) => soma + i.valor, 0).toFixed(2))

  // A numeração da ordem sofre da mesma corrida do ticket de pesagem: ler o
  // maior e somar um deixa uma janela entre a leitura e a gravação. Aqui a
  // colisão é bem menos provável — ordens são emitidas por uma pessoa, no
  // administrativo, e não por quatro operadores ao mesmo tempo —, mas o custo
  // dela seria alto: a emissão falharia com um erro incompreensível depois de
  // o usuário já ter escolhido produtor, período e preços.
  //
  // Repare que a transação continua fazendo o trabalho dela: criar a ordem,
  // marcar as cargas e completar as análises acontecem juntas ou não
  // acontecem. A tentativa extra envolve a transação inteira, e não parte
  // dela — uma colisão desfaz tudo e refaz com o número seguinte.
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
            itens: {
              create: itens.map(({ cargaId, pesoLiquidoKg, precoKg, valor }) => ({
                cargaId, pesoLiquidoKg, precoKg, valor,
              })),
            },
          },
          include: { itens: true, produtor: { select: { nome: true, cpfCnpj: true, chavePix: true } } },
        }),
        // ---------------------------------------------------------------
        // O PREÇO ACORDADO SUBSTITUI O PREÇO DA BALANÇA
        // ---------------------------------------------------------------
        // A carga podia carregar um precoBaseKg antigo — digitado na pesagem,
        // antes de o preço mudar de lugar, ou combinado no campo. A partir da
        // emissão ele deixa de valer: quem negociou foi o administrativo,
        // agora, e é este o preço da carga.
        //
        // Sem esta atualização os dois preços conviviam, cada um de um
        // momento, e as telas que mostram "desconto concedido" liam a
        // diferença entre eles como se fosse desconto de qualidade — somando
        // milhares de reais de desconto que nunca existiram.
        ...itens.map((i) =>
          prisma.carga.update({
            where: { id: i.cargaId },
            data: { situacao: 'EM_ORDEM_PAGAMENTO', precoBaseKg: i.precoBaseKg },
          })
        ),
        // Fecha o histórico da análise com o valor que ela não tinha como
        // saber na hora. Sem isto, a análise ficaria para sempre sem preço, e
        // as consultas de valor por carga — Dashboard, Matéria-prima,
        // Relatórios — não teriam de onde ler.
        ...itens.map((i) =>
          prisma.analiseQualidade.update({
            where: { id: i.analiseId },
            data: { precoAjustadoKg: i.precoKg, valorTotal: i.valor },
          })
        ),
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

// ---------------------------------------------------------------------------
// CARGAS ELEGÍVEIS · a mesma consulta usada pela prévia e pela emissão
// ---------------------------------------------------------------------------
// Uma função só, e não duas consultas parecidas, porque a prévia PRECISA
// mostrar exatamente o que a emissão vai gravar. Se as duas divergissem, o
// administrativo veria um total na tela e outro na ordem — e descobriria isso
// depois de emitir.
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

/** Aceita [{cargaId, precoKg}] e devolve um mapa, recusando preço inválido. */
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

// ---------------------------------------------------------------------------
// ITENS DA ORDEM · onde o preço acordado encontra o desconto medido
// ---------------------------------------------------------------------------
// Pura de propósito: recebe as cargas e o mapa de preços, devolve os itens.
// Sem banco, sem transação — o que permite testar a conta do valor sem subir
// o PostgreSQL, que é onde ela costuma passar despercebida.
//
// O preço vem POR CARGA, e não uma vez para a ordem inteira, porque é assim
// que a ervateira negocia: um produtor pode entregar erva-mate e lenha no
// mesmo período, e elas valem valores muito diferentes. Um preço único
// produziria um número que não corresponde a nenhum acordo real.
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

    // O desconto já foi medido pelo laboratório e está gravado na análise.
    // Aqui ele apenas se aplica ao preço que o administrativo acabou de
    // informar. A regra de qualidade não é recalculada: ela já aconteceu.
    const desconto = Number(c.analise.descontoPercentual)
    const precoAjustadoKg = Number((precoKg * (1 - desconto / 100)).toFixed(4))
    const valor = Number((Number(c.pesoLiquidoKg) * precoAjustadoKg).toFixed(2))

    return {
      cargaId: c.id,
      analiseId: c.analise.id,
      pesoLiquidoKg: c.pesoLiquidoKg,
      // O preço acordado, ANTES do desconto. Não vai para o item da ordem — o
      // item guarda o preço efetivamente pago —, mas volta para a carga, pelo
      // motivo explicado na transação da emissão.
      precoBaseKg: precoKg,
      precoKg: precoAjustadoKg,
      valor,
    }
  })
}

// ---------------------------------------------------------------------------
// PRÉVIA DA ORDEM
// ---------------------------------------------------------------------------
// Mostra o que entraria na ordem ANTES de emitir, com o desconto que cada
// carga já carrega da análise. É o que permite ao administrativo informar o
// preço olhando para a carga concreta — peso, tipo e qualidade medida — em vez
// de digitar um número no escuro.
//
// Existe também por um motivo de diagnóstico: quando não há nada a emitir, a
// prévia diz POR QUE. Antes, a tentativa de gerar simplesmente falhava com
// "nenhuma carga analisada e em aberto", sem dizer se faltava análise, se o
// período estava errado, ou se as cargas já tinham sido pagas.
async function previaDaOrdem({ produtorId, periodoInicio, periodoFim }) {
  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)
  const { inicio, fim } = periodoDe(periodoInicio, periodoFim)

  const cargas = await cargasElegiveis(produtorId, inicio, fim)

  // Quando não há nada elegível, contamos o que existe no período para poder
  // explicar. É a diferença entre "não tem carga" e "tem, mas ainda não foi
  // analisada" — e só a segunda tem conserto pelo usuário.
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
      // Sugestão de preço, quando existe: o que foi combinado na balança ou no
      // campo. É só ponto de partida — quem decide é quem emite.
      precoSugeridoKg: c.precoBaseKg,
      palitoPercentual: c.analise.palitoPercentual,
      limitePalito: c.analise.limitePalito,
      descontoPercentual: c.analise.descontoPercentual,
    })),
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

module.exports = { gerarOrdem, previaDaOrdem, confirmarPagamento, listar, mapearPrecos, montarItens, periodoDe }
