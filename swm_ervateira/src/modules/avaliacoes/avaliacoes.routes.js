const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

const RELACIONADOS = {
  erval: {
    select: {
      id: true, identificacao: true, tipoErva: true, idadeAnos: true,
      produtor: { select: { id: true, nome: true, cpfCnpj: true, municipio: true, uf: true } },
    },
  },
  usuario: { select: { id: true, nome: true } },
  fotos: { select: { id: true, clientId: true, caminho: true, largura: true, altura: true, sincronizadoEm: true } },
  _count: { select: { cargas: true } },
}

async function comSituacao(avaliacoes) {
  if (avaliacoes.length === 0) return []

  const registros = await prisma.registroSincronizacao.findMany({
    where: { clientId: { in: avaliacoes.map((a) => a.clientId) } },
    select: {
      clientId: true, dispositivoId: true, situacao: true,
      tentativas: true, houveConflito: true, versaoVencedora: true,
      criadoEmOrigem: true, recebidoEm: true,
    },
  })

  const porClientId = new Map(registros.map((r) => [r.clientId, r]))
  return avaliacoes.map((a) => ({ ...a, sincronizacao: porClientId.get(a.clientId) || null }))
}

router.get('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const { produtorId, de, ate, comFoto } = req.query
  const pagina = Number(req.query.pagina) || 1
  const porPagina = Math.min(Number(req.query.porPagina) || 20, 200)

  const where = {}
  if (produtorId) where.erval = { produtorId }
  if (de || ate) {
    where.dataAvaliacao = {}
    if (de) where.dataAvaliacao.gte = new Date(de)
    if (ate) where.dataAvaliacao.lte = new Date(ate)
  }
  if (comFoto === 'true') where.fotos = { some: {} }

  const [total, avaliacoes, coletadasEmCampo, comFotos] = await prisma.$transaction([
    prisma.avaliacao.count({ where }),
    prisma.avaliacao.findMany({
      where,
      orderBy: { dataAvaliacao: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: RELACIONADOS,
    }),
    prisma.avaliacao.count({ where: { ...where, criadoOffline: true } }),
    prisma.avaliacao.count({ where: { ...where, fotos: { some: {} } } }),
  ])

  res.json({
    total,
    pagina,
    porPagina,
    coletadasEmCampo,
    comFotos,
    avaliacoes: await comSituacao(avaliacoes),
  })
})

router.get('/:id', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id: req.params.id },
    include: {
      ...RELACIONADOS,
      cargas: {
        select: {
          id: true, numeroTicket: true, dataHora: true,
          pesoLiquidoKg: true, pesoEstimadoCampoKg: true, situacao: true,
        },
      },
    },
  })

  if (!avaliacao) return res.status(404).json({ erro: 'Avaliação não encontrada' })

  const [comIsso] = await comSituacao([avaliacao])
  res.json(comIsso)
})

module.exports = router
