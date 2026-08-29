// ---------------------------------------------------------------------------
// SERVIÇO · análise de qualidade
// ---------------------------------------------------------------------------
// Regras do laboratório. É aqui que o percentual de palito vira DESCONTO e a
// carga fica liberada para pagamento.
//
// O que este serviço NÃO faz mais: definir valor. A análise mede qualidade, e
// qualidade não depende de preço. O laboratório registra quanto de palito a
// amostra tinha e quanto de desconto isso gera — em pontos percentuais. Quanto
// vale a carga é decisão do administrativo, na emissão da ordem, e é lá que o
// preço entra.
//
// Quando a carga já tem preço — de uma pesagem antiga, ou de um valor
// combinado no campo — o valor é calculado aqui também, como antes. Sem preço,
// preço ajustado e valor total ficam nulos até a ordem informar.
//
// Repare que este serviço REAPROVEITA o calcularPagamento do módulo de cargas
// em vez de repetir a conta. Se a fórmula mudar, muda em um lugar só — e o
// teste unitário continua cobrindo os dois caminhos.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { calcularPagamento } = require('../cargas/cargas.service')
const parametros = require('../parametros/parametros.service')
const { conferirLimites, exigeJustificativa } = require('./limites')

// ---------------------------------------------------------------------------
// REGRA · carga reprovada não tem valor
// ---------------------------------------------------------------------------
// O desconto continua gravado: ele é medida de laboratório e existe
// independentemente do destino da carga. O que não existe é preço ajustado e
// valor — carga reprovada não entra em ordem de pagamento (cargasElegiveis
// exige situação ANALISADA) e portanto nunca vira dinheiro.
//
// Zerar aqui, e não filtrar nas telas, é deliberado. Filtro em tela é uma regra
// que cada relatório novo precisa lembrar de repetir, e um dia alguém esquece.
// O dado que não pode ser somado simplesmente não é gravado.
//
// Está separada da gravação para poder ser testada sem banco.
function valorDaAnalise(calculo, aprovada) {
  if (!aprovada) return { precoAjustadoKg: null, valorTotal: null }
  return { precoAjustadoKg: calculo.precoAjustadoKg, valorTotal: calculo.valorTotal }
}

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

  // A RÉGUA VEM DO BANCO, e não de uma constante deste arquivo.
  // Quem define até quanto de palito se aceita é a ervateira, não o programa.
  const regua = await parametros.obter()

  const umidade = umidadePercentual != null ? Number(umidadePercentual) : null
  const folha = folhaPercentual != null ? Number(folhaPercentual) : null

  // O servidor CONFERE; quem decide continua sendo o analista, que já mandou
  // seu `aprovada` no corpo. A conferência serve para duas coisas: explicar a
  // reprovação sem depender de texto livre, e obrigar a justificar quando a
  // pessoa contraria a régua.
  const limitesEstourados = conferirLimites(
    { palitoPercentual: palito, umidadePercentual: umidade, folhaPercentual: folha },
    regua
  )

  const precisaJustificar = exigeJustificativa({ aprovada, limitesEstourados })
  const justificativa = String(dados.motivoReprovacao ?? '').trim()
  if (precisaJustificar && !justificativa) {
    throw new ErroDeNegocio(
      aprovada
        ? 'Explique por que está aprovando apesar do limite'
        : 'Informe o motivo da reprovação',
      400,
      aprovada
        ? 'A amostra estourou um limite e mesmo assim está sendo aprovada. Registrar o porquê é o que permite entender a decisão depois.'
        : 'Nenhum limite foi estourado. Sem o motivo escrito, ninguém saberá em que a reprovação se baseou.'
    )
  }

  // A conta acontece aqui — a mesma função usada na consulta de cálculo.
  // Com precoBaseKg nulo, ela devolve o desconto e deixa preço e valor nulos.
  const calculo = calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
    palitoPercentual: palito,
    limitePalito: regua.limitePalito,
    descontoPorPonto: regua.descontoPorPonto,
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
        // OS LIMITES DO DIA, copiados para dentro da análise. Se a ervateira
        // mudar a régua amanhã, este laudo continua dizendo o que disse.
        limitePalito: regua.limitePalito,
        palitoMaximo: regua.palitoMaximo,
        umidadeMaxima: regua.umidadeMaxima,
        folhaMinima: regua.folhaMinima,
        motivoReprovacao: justificativa || null,
        descontoPercentual: calculo.descontoPercentual,
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

  // Devolve o cálculo COMO FOI GRAVADO, e não como foi computado: a tela mostra
  // este retorno, e mostrar um valor que o banco não guardou seria mentir para
  // o analista no exato momento em que ele reprova a carga.
  return {
    analise,
    calculo: { ...calculo, precoAjustadoKg, valorTotal },
    limitesEstourados,
  }
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

module.exports = { registrarAnalise, filaDeAmostras, valorDaAnalise }
