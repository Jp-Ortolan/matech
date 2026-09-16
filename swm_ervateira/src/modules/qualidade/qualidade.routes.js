const { Router } = require('express')
const servico = require('./qualidade.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

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
  res.status(201).json(resultado)
})

module.exports = router
