const { Router } = require('express')
const servico = require('./pagamentos.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

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
  res.status(201).json(ordem)
})

router.post('/:id/confirmar', permitir('ADMINISTRATIVO'), async (req, res) => {
  res.json(await servico.confirmarPagamento(req.params.id))
})

module.exports = router
