// ---------------------------------------------------------------------------
// ROTA · painel
// ---------------------------------------------------------------------------
// Aberta a qualquer autenticado, como as cargas de onde ela sai. O que muda
// por perfil é o CONTEÚDO: quem não pode ver dinheiro recebe um painel sem as
// ordens e sem o desconto em reais, porque as consultas nem rodam.

const { Router } = require('express')
const servico = require('./dashboard.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { podeNegocio } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// GET /api/dashboard
router.get('/', async (req, res) => {
  const veDinheiro = podeNegocio(req.usuario.perfil, 'ADMINISTRATIVO')
  res.json(await servico.montar({ veDinheiro }))
})

module.exports = router
