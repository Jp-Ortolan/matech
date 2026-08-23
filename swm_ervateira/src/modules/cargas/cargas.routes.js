// ---------------------------------------------------------------------------
// ROTAS · cargas
// ---------------------------------------------------------------------------
// Lendo daqui você sabe, de relance, quem pode fazer o quê.

const { Router } = require('express')
const controlador = require('./cargas.controller')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()

// Daqui para baixo, toda rota exige token.
router.use(autenticar)

// Consultar pode qualquer perfil autenticado (RF12 a RF14)
router.get('/', controlador.listar)
router.get('/:id', controlador.buscar)
router.get('/:id/calculo', controlador.calculo)

// Registrar pesagem é do operador de balança (RF06 a RF09)
router.post('/', permitir('OPERADOR_BALANCA'), controlador.registrar)

module.exports = router
