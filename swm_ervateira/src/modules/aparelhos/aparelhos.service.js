const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

// Confere o que o app mandou. Contagem é inteiro de 0 para cima.
function lerAviso({ dispositivoId, naFila, comErro } = {}) {
  const id = String(dispositivoId ?? '').trim()
  if (id.length < 8 || id.length > 64) {
    throw new ErroDeNegocio('Identificador do aparelho inválido', 400)
  }
  return { id, naFila: contagem(naFila, 'naFila'), comErro: contagem(comErro, 'comErro') }
}

function contagem(valor, campo) {
  const n = valor === undefined || valor === null ? 0 : Number(valor)
  if (!Number.isInteger(n) || n < 0) {
    throw new ErroDeNegocio(`${campo} precisa ser um inteiro de 0 para cima`, 400)
  }
  return n
}

// O app chama a cada contato com o servidor.
async function registrarContato(corpo, usuarioId) {
  const { id, naFila, comErro } = lerAviso(corpo)
  const dados = { usuarioId, naFila, comErro, ultimoContato: new Date() }
  await prisma.aparelho.upsert({ where: { id }, create: { id, ...dados }, update: dados })
  return { ok: true }
}

async function listar() {
  const aparelhos = await prisma.aparelho.findMany({
    orderBy: [{ naFila: 'desc' }, { ultimoContato: 'desc' }],
    include: { usuario: { select: { nome: true } } },
  })
  return {
    aparelhos,
    totalNaFila: aparelhos.reduce((s, a) => s + a.naFila, 0),
  }
}

module.exports = { lerAviso, registrarContato, listar }
