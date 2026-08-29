// ---------------------------------------------------------------------------
// SERVIÇO · parâmetros de qualidade
// ---------------------------------------------------------------------------
// A régua da ervateira: até quanto de palito se aceita sem desconto, quanto
// cada ponto excedente desconta, e a partir de onde a carga é reprovada.
//
// Estes números estavam no código, como constantes com um comentário dizendo
// que eram provisórios. Não eram provisórios — eram do cliente errado. Limite
// de palito e desconto por ponto são regra comercial: mudam de ervateira para
// ervateira, e dentro da mesma ervateira mudam por negociação. O sistema tem
// de perguntar, não decidir.
//
// Os três limites de REPROVAÇÃO nascem nulos, e nulo significa "não reprovamos
// por este critério" — que é diferente de zero. Enquanto a ervateira não
// definir, o laboratório mede e registra, e quem reprova é a pessoa.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

const ID = 'padrao'

// O que vale enquanto ninguém gravou nada. São os mesmos números que estavam
// no código antes, para que a migração não mude comportamento nenhum.
const PADRAO = {
  limitePalito: 30,
  descontoPorPonto: 1,
  palitoMaximo: null,
  umidadeMaxima: null,
  folhaMinima: null,
}

/** Lê os parâmetros em vigor. Nunca devolve nulo: sem linha, devolve o padrão. */
async function obter() {
  const linha = await prisma.parametroQualidade.findUnique({ where: { id: ID } })
  if (!linha) return { ...PADRAO, atualizadoEm: null, usuarioId: null }

  return {
    limitePalito: Number(linha.limitePalito),
    descontoPorPonto: Number(linha.descontoPorPonto),
    palitoMaximo: linha.palitoMaximo === null ? null : Number(linha.palitoMaximo),
    umidadeMaxima: linha.umidadeMaxima === null ? null : Number(linha.umidadeMaxima),
    folhaMinima: linha.folhaMinima === null ? null : Number(linha.folhaMinima),
    atualizadoEm: linha.atualizadoEm,
    usuarioId: linha.usuarioId,
  }
}

/**
 * Valida um percentual que pode ser deixado em branco.
 *
 * Em branco é uma resposta legítima aqui — "não reprovamos por umidade" — e
 * precisa ser distinguida de zero, que seria "reprovamos qualquer umidade
 * acima de zero", isto é, tudo.
 */
function percentualOpcional(valor, rotulo) {
  if (valor === undefined || valor === null || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n)) throw new ErroDeNegocio(`${rotulo} precisa ser um número`, 400)
  if (n < 0 || n > 100) throw new ErroDeNegocio(`${rotulo} deve ficar entre 0 e 100`, 400)
  return Number(n.toFixed(2))
}

function percentualObrigatorio(valor, rotulo) {
  const n = percentualOpcional(valor, rotulo)
  if (n === null) throw new ErroDeNegocio(`Informe ${rotulo.toLowerCase()}`, 400)
  return n
}

async function salvar(dados, usuarioId) {
  const limitePalito = percentualObrigatorio(dados.limitePalito, 'O limite de palito')

  // O desconto por ponto não é percentual da amostra, é ponto de preço — mas
  // aceitar 900 aqui geraria preço negativo, o que o cálculo não trata e não
  // deveria precisar tratar.
  const descontoPorPonto = percentualObrigatorio(dados.descontoPorPonto, 'O desconto por ponto')

  const palitoMaximo = percentualOpcional(dados.palitoMaximo, 'O palito máximo')
  const umidadeMaxima = percentualOpcional(dados.umidadeMaxima, 'A umidade máxima')
  const folhaMinima = percentualOpcional(dados.folhaMinima, 'A folha mínima')

  // Reprovar por palito ANTES de descontar por palito não faz sentido: a faixa
  // de desconto ficaria inalcançável, e o laboratório nunca veria um desconto.
  if (palitoMaximo !== null && palitoMaximo < limitePalito) {
    throw new ErroDeNegocio(
      'O palito máximo não pode ser menor que o limite de desconto',
      400,
      `Com desconto a partir de ${limitePalito}% e reprovação em ${palitoMaximo}%, nenhuma carga chegaria a receber desconto — seria reprovada antes.`
    )
  }

  const valores = { limitePalito, descontoPorPonto, palitoMaximo, umidadeMaxima, folhaMinima, usuarioId }

  await prisma.parametroQualidade.upsert({
    where: { id: ID },
    update: valores,
    create: { id: ID, ...valores },
  })

  return obter()
}

module.exports = { obter, salvar, PADRAO, ID }
