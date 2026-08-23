// ---------------------------------------------------------------------------
// ROTAS E CONTROLADOR · análise de qualidade
// ---------------------------------------------------------------------------
// Módulo pequeno, então o controlador está junto das rotas.
// Só o analista de qualidade (e o administrativo) lançam análise.

const { Router } = require('express')
const servico = require('./qualidade.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// GET /api/qualidade/fila — amostras aguardando análise
router.get('/fila', async (req, res) => {
  res.json(await servico.filaDeAmostras())
})

// POST /api/qualidade/cargas/:cargaId — lançar a análise
router.post('/cargas/:cargaId', permitir('ANALISTA_QUALIDADE'), async (req, res) => {
  const resultado = await servico.registrarAnalise(
    req.params.cargaId,
    req.body,
    req.usuario.id      // quem analisou vem do token, não do corpo
  )
  res.status(201).json(resultado)
})

module.exports = router
