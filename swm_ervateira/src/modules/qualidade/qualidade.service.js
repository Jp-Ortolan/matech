const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { calcularPagamento } = require('../cargas/cargas.service')

function valorDaAnalise(calculo, aprovada) {
  if (!aprovada) return { precoAjustadoKg: null, valorTotal: null }
  return { precoAjustadoKg: calculo.precoBaseKg, valorTotal: calculo.valorTotal }
}

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

  const umidade = umidadePercentual != null ? Number(umidadePercentual) : null
  const folha = folhaPercentual != null ? Number(folhaPercentual) : null

  const justificativa = String(dados.motivoReprovacao ?? '').trim()
  if (!aprovada && !justificativa) {
    throw new ErroDeNegocio(
      'Informe o motivo da reprovação',
      400,
      'Sem o motivo escrito, ninguém saberá em que a reprovação se baseou.'
    )
  }

  const calculo = calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
  })

  const { precoAjustadoKg, valorTotal } = valorDaAnalise(calculo, aprovada)

  const [analise] = await prisma.$transaction([
    prisma.analiseQualidade.create({
      data: {
        cargaId,
        usuarioId,
        palitoPercentual: palito,
        umidadePercentual: umidade,
        folhaPercentual: folha,
        observacoes,
        motivoReprovacao: justificativa || null,
        precoAjustadoKg,
        valorTotal,
        aprovada,
      },
    }),
    prisma.carga.update({
      where: { id: cargaId },
      data: { situacao: aprovada ? 'ANALISADA' : 'REPROVADA' },
    }),
  ])

  return {
    analise,
    calculo: { ...calculo, precoAjustadoKg, valorTotal },
  }
}

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

module.exports = { registrarAnalise, filaDeAmostras, valorDaAnalise }
