// ---------------------------------------------------------------------------
// SERVIÇO · painel
// ---------------------------------------------------------------------------
// UMA consulta para a tela inteira, e o banco somando em vez do navegador.
//
// O QUE HAVIA ANTES, e por que precisava sair:
//
// O painel fazia sete requisições — uma janela de 500 cargas mais cinco
// contagens mais as ordens — e somava as 500 linhas em JavaScript. Duas coisas
// erradas nisso, e a segunda é pior que a primeira:
//
//   1. Sete idas ao servidor para desenhar uma tela, e 500 linhas de JSON
//      trafegando para virar quatro números.
//
//   2. A PARTIR DE 501 CARGAS OS NÚMEROS FICAVAM ERRADOS. Peso recebido,
//      distribuição por matéria-prima e médias de qualidade cobriam só as 500
//      mais recentes. A tela avisava, num aviso amarelo no rodapé — mas um
//      painel que precisa avisar que está mentindo já é o painel errado. Numa
//      safra, uma ervateira média passa de 500 cargas em poucas semanas.
//
// Agora quem soma é o PostgreSQL, com GROUP BY e SUM, sobre a tabela inteira.
// O custo não muda com o volume: contar trinta mil linhas com índice é o mesmo
// trabalho que contar trezentas, e o que trafega são dezenas de bytes.
//
// SOBRE OS DOIS $queryRaw: eles existem porque comparam DUAS COLUNAS da mesma
// linha — palito medido contra o limite gravado, e preço base contra preço
// ajustado. O Prisma não expressa isso no `where` tipado; expressa igualdade
// com valor, não com outra coluna. São duas consultas curtas, parametrizadas
// pelo próprio Prisma, e ficam aqui em vez de virarem um laço em JavaScript
// sobre a tabela toda.

const { prisma } = require('../../lib/prisma')
const { ocultarDaCarga } = require('../../lib/sigilo')
const parametros = require('../parametros/parametros.service')

const SITUACOES = [
  'AGUARDANDO_ANALISE',
  'ANALISADA',
  'EM_ORDEM_PAGAMENTO',
  'PAGA',
  'REPROVADA',
]

/**
 * Monta o painel inteiro.
 *
 * `veDinheiro` decide o que entra, e não o que é escondido depois: as
 * consultas de ordens e de desconto simplesmente não rodam para quem não pode
 * vê-las. Uma requisição a menos, e nenhum número no corpo da resposta
 * esperando para ser filtrado por engano.
 */
async function montar({ veDinheiro }) {
  const [
    porSituacao,
    porTipo,
    totais,
    qualidade,
    reprovadas,
    acimaDoLimite,
    ultimas,
    regua,
  ] = await Promise.all([
    prisma.carga.groupBy({
      by: ['situacao'],
      _count: { _all: true },
    }),
    prisma.carga.groupBy({
      by: ['tipoMateriaPrima'],
      _count: { _all: true },
      _sum: { pesoLiquidoKg: true },
    }),
    prisma.carga.aggregate({
      _count: { _all: true },
      _sum: { pesoLiquidoKg: true },
    }),
    prisma.analiseQualidade.aggregate({
      _count: { _all: true },
      _avg: { palitoPercentual: true },
    }),
    prisma.analiseQualidade.count({ where: { aprovada: false } }),
    contarAcimaDoLimite(),
    prisma.carga.findMany({
      orderBy: { dataHora: 'desc' },
      take: 5,
      include: {
        produtor: { select: { id: true, nome: true, cpfCnpj: true } },
        analise: true,
      },
    }),
    parametros.obter(),
  ])

  const contagens = contagensPorSituacao(porSituacao)

  const totalCargas = totais._count._all
  const analises = qualidade._count._all

  const painel = {
    totais: {
      cargas: totalCargas,
      pesoLiquidoKg: numero(totais._sum.pesoLiquidoKg),
    },
    porSituacao: contagens,
    porTipo: porTipo
      .map((t) => ({
        tipo: t.tipoMateriaPrima,
        cargas: t._count._all,
        peso: numero(t._sum.pesoLiquidoKg),
      }))
      .sort((a, b) => b.peso - a.peso),
    qualidade: {
      analises,
      reprovadas,
      aprovadas: analises - reprovadas,
      palitoMedio: qualidade._avg.palitoPercentual === null ? null : numero(qualidade._avg.palitoPercentual),
      acimaDoLimite,
      limitePalito: regua.limitePalito,
    },
    // A mesma limpeza da rota de cargas: preço e valor saem para quem não os
    // vê, e o CPF do produtor não vai junto.
    ultimasCargas: ultimas.map((c) => ocultarDaCarga(c, { veDinheiro })),
    ordens: null,
    descontoEmReais: null,
  }

  if (veDinheiro) {
    const [ordens, desconto] = await Promise.all([
      resumoDeOrdens(),
      somarDesconto(),
    ])
    painel.ordens = ordens
    painel.descontoEmReais = desconto
  }

  return painel
}

// ---------------------------------------------------------------------------
// As duas que precisam comparar coluna com coluna
// ---------------------------------------------------------------------------

/** Análises em que o palito medido passou do limite gravado NAQUELA análise. */
async function contarAcimaDoLimite() {
  // Compara duas colunas da mesma linha, e é por isso que não sai em Prisma
  // tipado. Repare que compara com o limite DA ANÁLISE, e não com o limite de
  // hoje: se a ervateira apertar a régua, as análises antigas não podem passar
  // a contar como se tivessem estourado um limite que não existia.
  const [linha] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
      FROM "analises_qualidade"
     WHERE "palitoPercentual" > "limitePalito"
  `
  return linha?.total ?? 0
}

/**
 * Quanto o desconto por qualidade custou ao produtor, em reais.
 *
 * Só as cargas que já têm preço — isto é, as que passaram por uma ordem. Antes
 * da emissão o desconto existe em pontos percentuais e ainda não virou
 * dinheiro.
 */
async function somarDesconto() {
  const [linha] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(c."pesoLiquidoKg" * (c."precoBaseKg" - a."precoAjustadoKg")), 0) AS total
      FROM "analises_qualidade" a
      JOIN "cargas" c ON c."id" = a."cargaId"
     WHERE c."precoBaseKg"    IS NOT NULL
       AND a."precoAjustadoKg" IS NOT NULL
  `
  return numero(linha?.total)
}

async function resumoDeOrdens() {
  const [porSituacao, emAberto] = await Promise.all([
    prisma.ordemPagamento.groupBy({
      by: ['situacao'],
      _count: { _all: true },
      _sum: { valorTotal: true },
    }),
    prisma.ordemPagamento.aggregate({
      where: { situacao: 'PENDENTE' },
      _sum: { valorTotal: true },
      _count: { _all: true },
    }),
  ])

  const emitidas = porSituacao.reduce((s, o) => s + o._count._all, 0)
  const pagas = porSituacao.find((o) => o.situacao === 'PAGA')

  return {
    emitidas,
    pagas: pagas?._count._all ?? 0,
    valorPago: numero(pagas?._sum.valorTotal),
    ordensEmAberto: emAberto._count._all,
    valorEmAberto: numero(emAberto._sum.valorTotal),
  }
}

/**
 * As cinco situações, sempre as cinco.
 *
 * O GROUP BY só devolve as situações que EXISTEM na tabela. Se nenhuma carga
 * foi reprovada ainda, REPROVADA simplesmente não vem — e a barra some do
 * ciclo, o que se lê como dado faltando e não como zero. Pior: a conta de
 * percentual quebra com undefined e a tela mostra "NaN%".
 *
 * Separada e pura para ter teste: é o tipo de detalhe que só aparece em banco
 * novo, e banco novo é exatamente o que a banca vai ver na apresentação.
 */
function contagensPorSituacao(linhas) {
  const contagens = Object.fromEntries(SITUACOES.map((s) => [s, 0]))
  for (const linha of linhas ?? []) {
    if (linha?.situacao in contagens) contagens[linha.situacao] = linha._count?._all ?? 0
  }
  return contagens
}

/** Decimal do Prisma, ou null, vira número. Nunca NaN, nunca string. */
function numero(v) {
  if (v === null || v === undefined) return 0
  return Number(Number(v).toFixed(2))
}

module.exports = { montar, contagensPorSituacao, numero, SITUACOES }
