const { Router } = require('express')
const controlador = require('./cargas.controller')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()

router.use(autenticar)

router.get('/', controlador.listar)
router.get('/:id', controlador.buscar)
router.get('/:id/calculo', controlador.calculo)

router.post('/', permitir('OPERADOR_BALANCA'), controlador.registrar)
router.patch('/:id/tara', permitir('OPERADOR_BALANCA'), controlador.fecharTara)

module.exports = router
