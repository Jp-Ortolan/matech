const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { lerNumero, estaVazio, DICA_FORMATO } = require('../../lib/numeros')
const { calcularPagamento } = require('../cargas/cargas.service')

// Umidade e folha são opcionais, mas se vierem precisam ser número de 0 a 100.
function percentualOpcional(valor, rotulo) {
  if (estaVazio(valor)) return null
  const n = lerNumero(valor)
  if (!Number.isFinite(n)) throw new ErroDeNegocio(`O percentual ${rotulo} precisa ser um número`, 400, DICA_FORMATO)
  if (n < 0 || n > 100) throw new ErroDeNegocio(`O percentual ${rotulo} deve ficar entre 0 e 100`, 400)
  return n
}

function valorDaAnalise(calculo, aprovada) {
  if (!aprovada) return { precoAjustadoKg: null, valorTotal: null }
  return { precoAjustadoKg: calculo.precoBaseKg, valorTotal: calculo.valorTotal }
}

async function registrarAnalise(cargaId, dados, usuarioId) {
  const { palitoPercentual, umidadePercentual, folhaPercentual, observacoes, aprovada = true } = dados

  if (estaVazio(palitoPercentual)) {
    throw new ErroDeNegocio('Informe o percentual de palito', 400)
  }
  const palito = lerNumero(palitoPercentual)
  if (!Number.isFinite(palito)) {
    throw new ErroDeNegocio('O percentual de palito precisa ser um número', 400, DICA_FORMATO)
  }
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

  const umidade = percentualOpcional(umidadePercentual, 'de umidade')
  const folha = percentualOpcional(folhaPercentual, 'de folha')

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
