// ---------------------------------------------------------------------------
// ROTAS · parâmetros de qualidade
// ---------------------------------------------------------------------------
// LER é aberto a qualquer autenticado, e ESCREVER exige perfil. A assimetria é
// proposital: o analista de qualidade precisa saber qual é a régua para lançar
// a análise — a tela mostra o limite ao lado do campo —, mas quem muda a régua
// é quem negocia com o produtor.
//
// permitir('ADMINISTRATIVO') acrescenta sozinho o ADMINISTRADOR, o que atende
// ao "o dono ou o funcionário define" sem precisar listar os dois.

const { Router } = require('express')
const servico = require('./parametros.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// GET /api/parametros/qualidade
router.get('/qualidade', async (req, res) => {
  res.json(await servico.obter())
})

// PUT /api/parametros/qualidade
router.put('/qualidade', permitir('ADMINISTRATIVO'), async (req, res) => {
  res.json(await servico.salvar(req.body, req.usuario.id))
})

module.exports = router
