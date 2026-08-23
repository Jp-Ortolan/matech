// ---------------------------------------------------------------------------
// ROTAS E CONTROLADOR · pagamentos
// ---------------------------------------------------------------------------
// Emitir e confirmar pagamento é atribuição exclusiva do administrativo,
// conforme a matriz de permissões da tela de Configurações.

const { Router } = require('express')
const servico = require('./pagamentos.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// GET /api/pagamentos?produtorId=&situacao=
router.get('/', async (req, res) => {
  const { produtorId, situacao } = req.query
  res.json(await servico.listar({ produtorId, situacao }))
})

// POST /api/pagamentos — gera a ordem do período (RF11)
router.post('/', permitir('ADMINISTRATIVO'), async (req, res) => {
  const ordem = await servico.gerarOrdem(req.body)
  res.status(201).json(ordem)
})

// POST /api/pagamentos/:id/confirmar — marca como paga
// O pagamento em si é feito pelo banco, fora do sistema. Aqui só se registra.
router.post('/:id/confirmar', permitir('ADMINISTRATIVO'), async (req, res) => {
  res.json(await servico.confirmarPagamento(req.params.id))
})

module.exports = router
