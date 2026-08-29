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
//
// A LISTA DE ORDENS É DINHEIRO, e passa a exigir perfil como a emissão já
// exigia. Quanto cada produtor recebeu, e quanto ainda se deve a ele, é
// informação do administrativo — não do operador de balança nem do analista.
// É segregação de função, e é o que permite ao menu esconder Pagamentos sem
// que isso seja uma regra só de tela.
router.get('/', permitir('ADMINISTRATIVO'), async (req, res) => {
  const { produtorId, situacao } = req.query
  res.json(await servico.listar({ produtorId, situacao }))
})

// GET /api/pagamentos/previa?produtorId=&periodoInicio=&periodoFim=
// O que entraria na ordem, antes de emitir. Só o administrativo: a prévia
// expõe peso e qualidade de cada carga, que é informação de negociação.
router.get('/previa', permitir('ADMINISTRATIVO'), async (req, res) => {
  const { produtorId, periodoInicio, periodoFim } = req.query
  res.json(await servico.previaDaOrdem({ produtorId, periodoInicio, periodoFim }))
})

// POST /api/pagamentos — gera a ordem do período (RF11)
// O corpo traz o preço por carga: { produtorId, periodoInicio, periodoFim,
// precos: [{ cargaId, precoKg }] }
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
