const { Router } = require('express')
const controlador = require('./usuarios.controller')
const { autenticar } = require('../../middlewares/autenticacao')
const { apenas } = require('../../middlewares/autorizacao')

const router = Router()

router.use(autenticar, apenas('ADMINISTRADOR'))

router.get('/', controlador.listar)
router.post('/', controlador.criar)
router.put('/:id', controlador.atualizar)
router.put('/:id/senha', controlador.redefinirSenha)

module.exports = router
