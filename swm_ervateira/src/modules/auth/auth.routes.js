// ---------------------------------------------------------------------------
// ROTAS · autenticação
// ---------------------------------------------------------------------------
// A ROTA só diz três coisas: qual método HTTP, qual endereço, e qual
// controlador atende. Nada mais.
//
// Ler este arquivo deve bastar para saber tudo que o módulo expõe.

const { Router } = require('express')
const controlador = require('./auth.controller')
const { autenticar } = require('../../middlewares/autenticacao')

const router = Router()

// Aberta: é por aqui que se consegue o token.
router.post('/login', controlador.login)

// Protegida: o middleware autenticar roda antes e barra quem não tem token.
router.get('/eu', autenticar, controlador.eu)

module.exports = router
