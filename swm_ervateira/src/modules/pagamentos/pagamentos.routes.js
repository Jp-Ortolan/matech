const { Router } = require('express')
const servico = require('./pagamentos.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')
const { prisma } = require('../../lib/prisma')
const { registrar, apenasCampos, ACOES } = require('../../lib/auditoria')

const router = Router()
router.use(autenticar)

router.get('/', permitir('ADMINISTRATIVO'), async (req, res) => {
  const { produtorId, situacao } = req.query
  res.json(await servico.listar({ produtorId, situacao }))
})

router.get('/aguardando', permitir('ADMINISTRATIVO'), async (req, res) => {
  res.json(await servico.aguardandoOrdem())
})

router.get('/previa', permitir('ADMINISTRATIVO'), async (req, res) => {
  const { produtorId, periodoInicio, periodoFim } = req.query
  res.json(await servico.previaDaOrdem({ produtorId, periodoInicio, periodoFim }))
})

router.post('/', permitir('ADMINISTRATIVO'), async (req, res) => {
  const ordem = await servico.gerarOrdem(req.body)

  await registrar(req, {
    acao: ACOES.ORDEM_EMITIDA,
    entidade: 'OrdemPagamento',
    entidadeId: ordem.id,
    alvo: [ordem.numero, ordem.produtor?.nome].filter(Boolean).join(' · '),
    depois: {
      valorTotal: Number(ordem.valorTotal),
      cargas: ordem.itens?.length ?? 0,
      ...apenasCampos(ordem, ['periodoInicio', 'periodoFim']),
    },
  })

  res.status(201).json(ordem)
})

router.post('/:id/confirmar', permitir('ADMINISTRATIVO'), async (req, res) => {
  const paga = await servico.confirmarPagamento(req.params.id)

  const produtor = await prisma.produtor.findUnique({ where: { id: paga.produtorId }, select: { nome: true } })
  await registrar(req, {
    acao: ACOES.ORDEM_PAGA,
    entidade: 'OrdemPagamento',
    entidadeId: paga.id,
    alvo: [paga.numero, produtor?.nome].filter(Boolean).join(' · '),
    antes: { situacao: 'PENDENTE' },
    depois: { situacao: 'PAGA' },
  })

  res.json(paga)
})

module.exports = router
