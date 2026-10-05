const { Router } = require('express')

const servico = require('./aparelhos.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// Mesmo perfil que sincroniza: quem usa o app em campo.
router.post('/contato', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.registrarContato(req.body, req.usuario.id))
})

router.get('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.listar())
})

module.exports = router
