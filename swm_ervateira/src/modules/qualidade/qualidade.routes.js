const { Router } = require('express')
const servico = require('./qualidade.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')
const { prisma } = require('../../lib/prisma')
const { registrar, apenasCampos, ACOES } = require('../../lib/auditoria')

const router = Router()
router.use(autenticar)

router.get('/fila', permitir('ANALISTA_QUALIDADE'), async (req, res) => {
  res.json(await servico.filaDeAmostras())
})

router.post('/cargas/:cargaId', permitir('ANALISTA_QUALIDADE'), async (req, res) => {
  const resultado = await servico.registrarAnalise(
    req.params.cargaId,
    req.body,
    req.usuario.id      // quem analisou vem do token, não do corpo
  )

  const carga = await prisma.carga.findUnique({
    where: { id: req.params.cargaId },
    select: { numeroTicket: true, produtor: { select: { nome: true } } },
  })
  await registrar(req, {
    acao: ACOES.ANALISE_LANCADA,
    entidade: 'Carga',
    entidadeId: req.params.cargaId,
    alvo: [carga?.numeroTicket, carga?.produtor?.nome].filter(Boolean).join(' · '),
    depois: apenasCampos(resultado.analise, [
      'aprovada', 'palitoPercentual', 'umidadePercentual', 'folhaPercentual', 'motivoReprovacao', 'valorTotal',
    ]),
  })

  res.status(201).json(resultado)
})

module.exports = router
