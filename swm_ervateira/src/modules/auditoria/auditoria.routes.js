const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { apenas } = require('../../middlewares/autorizacao')
const { lerData } = require('../../lib/validacao')

const { ErroDeNegocio } = require('../../middlewares/erros')

const router = Router()
router.use(autenticar, apenas('ADMINISTRADOR'))

router.get('/', async (req, res) => {
  const { acao, usuarioId, de, ate } = req.query
  const limite = Math.min(Math.max(1, parseInt(req.query.limite, 10) || 200), 500)
  const DIA = /^\d{4}-\d{2}-\d{2}$/   // AAAA-MM-DD

  const where = {}
  if (acao) where.acao = String(acao)
  if (usuarioId) where.usuarioId = String(usuarioId)
  if (de || ate) {
    where.criadoEm = {}
    if (de && !DIA.test(de)) throw new ErroDeNegocio('Data inicial inválida: use AAAA-MM-DD', 400)
    if (ate && !DIA.test(ate)) throw new ErroDeNegocio('Data final inválida: use AAAA-MM-DD', 400)
    if (de) where.criadoEm.gte = lerData(`${de}T00:00:00`, 'a data inicial')
    if (ate) where.criadoEm.lte = lerData(`${ate}T23:59:59.999`, 'a data final')
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
