const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { apenas } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar, apenas('ADMINISTRADOR'))

router.get('/', async (req, res) => {
  const { acao, usuarioId, de, ate } = req.query
  const limite = Math.min(Number(req.query.limite) || 200, 500)

  const where = {}
  if (acao) where.acao = acao
  if (usuarioId) where.usuarioId = usuarioId
  if (de || ate) {
    where.criadoEm = {}
    if (de) where.criadoEm.gte = new Date(`${de}T00:00:00`)
    if (ate) where.criadoEm.lte = new Date(`${ate}T23:59:59.999`)
  }

  const [total, registros] = await prisma.$transaction([
    prisma.registroAuditoria.count({ where }),
    prisma.registroAuditoria.findMany({ where, orderBy: { criadoEm: 'desc' }, take: limite }),
  ])

  res.json({ total, exibindo: registros.length, registros })
})

router.get('/autores', async (req, res) => {
  const grupos = await prisma.registroAuditoria.groupBy({
    by: ['usuarioId', 'usuarioNome'],
    _count: true,
    orderBy: { _count: { usuarioId: 'desc' } },
  })

  const ids = [...new Set(grupos.map((g) => g.usuarioId))]
  const existentes = new Set(
    (await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((u) => u.id)
  )

  res.json({
    autores: grupos.map((g) => ({
      id: g.usuarioId,
      nome: g.usuarioNome,
      alteracoes: g._count,
      contaAtiva: existentes.has(g.usuarioId),
    })),
  })
})

module.exports = router
