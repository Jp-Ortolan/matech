// ---------------------------------------------------------------------------
// SERVIÇO · análise de qualidade
// ---------------------------------------------------------------------------
// Regras do laboratório. É aqui que o percentual de palito vira desconto no
// preço e a carga fica liberada para pagamento.
//
// Repare que este serviço REAPROVEITA o calcularPagamento do módulo de cargas
// em vez de repetir a conta. Se a fórmula mudar, muda em um lugar só — e o
// teste unitário continua cobrindo os dois caminhos.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { calcularPagamento } = require('../cargas/cargas.service')

// Parâmetros provisórios da regra de desconto.
// Quando a ervateira informar a fórmula oficial, é só trocar aqui.
const LIMITE_PALITO_PADRAO = 30
const DESCONTO_POR_PONTO = 1

/**
 * Registra a análise de uma carga e recalcula o valor a pagar.
 *
 * Usa uma TRANSAÇÃO: ou as duas operações acontecem (criar a análise e mudar
 * a situação da carga), ou nenhuma acontece. Sem isso, uma falha no meio
 * deixaria uma análise gravada apontando para uma carga ainda "aguardando".
 */
async function registrarAnalise(cargaId, dados, usuarioId) {
  const { palitoPercentual, umidadePercentual, folhaPercentual, observacoes, aprovada = true } = dados

  if (palitoPercentual === undefined || palitoPercentual === null) {
    throw new ErroDeNegocio('Informe o percentual de palito', 400)
  }
  const palito = Number(palitoPercentual)
  if (palito < 0 || palito > 100) {
    throw new ErroDeNegocio('O percentual de palito deve ficar entre 0 e 100', 400)
  }

  const carga = await prisma.carga.findUnique({
    where: { id: cargaId },
    include: { analise: true },
  })
  if (!carga) throw new ErroDeNegocio('Carga não encontrada', 404)
  if (carga.analise) throw new ErroDeNegocio('Esta carga já possui análise registrada', 409)
  if (carga.situacao === 'PAGA') throw new ErroDeNegocio('Esta carga já foi paga', 409)

  // A conta acontece aqui — a mesma função usada na consulta de cálculo.
  const calculo = calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
    palitoPercentual: palito,
    limitePalito: LIMITE_PALITO_PADRAO,
    descontoPorPonto: DESCONTO_POR_PONTO,
  })

  const [analise] = await prisma.$transaction([
    prisma.analiseQualidade.create({
      data: {
        cargaId,
        usuarioId,
        palitoPercentual: palito,
        umidadePercentual: umidadePercentual != null ? Number(umidadePercentual) : null,
        folhaPercentual: folhaPercentual != null ? Number(folhaPercentual) : null,
        observacoes,
        limitePalito: LIMITE_PALITO_PADRAO,
        descontoPercentual: calculo.descontoPercentual,
        precoAjustadoKg: calculo.precoAjustadoKg,
        valorTotal: calculo.valorTotal,
        aprovada,
      },
    }),
    prisma.carga.update({
      where: { id: cargaId },
      data: { situacao: aprovada ? 'ANALISADA' : 'REPROVADA' },
    }),
  ])

  return { analise, calculo }
}

/** Cargas que chegaram e ainda não foram analisadas — a fila do laboratório. */
async function filaDeAmostras() {
  const cargas = await prisma.carga.findMany({
    where: { situacao: 'AGUARDANDO_ANALISE' },
    orderBy: { dataHora: 'asc' },   // a mais antiga primeiro
    include: {
      produtor: { select: { nome: true } },
      erval: { select: { identificacao: true } },
      avaliacao: { select: { classificacao: true, umidadeEstimada: true, ervaQueimada: true } },
    },
  })
  return { total: cargas.length, cargas }
}

module.exports = { registrarAnalise, filaDeAmostras, LIMITE_PALITO_PADRAO, DESCONTO_POR_PONTO }
