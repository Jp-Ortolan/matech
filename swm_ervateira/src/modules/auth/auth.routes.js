const { Router } = require('express')
const controlador = require('./auth.controller')
const { autenticar } = require('../../middlewares/autenticacao')

const router = Router()

router.post('/login', controlador.login)

router.get('/eu', autenticar, controlador.eu)

router.post('/senha', autenticar, controlador.trocarSenha)

module.exports = router
