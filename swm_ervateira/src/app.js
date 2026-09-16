const express = require('express')
const cors = require('cors')

const { prisma } = require('./lib/prisma')
const { PASTA_UPLOADS } = require('./config/env')
const { naoEncontrado, tratarErros } = require('./middlewares/erros')

const authRoutes = require('./modules/auth/auth.routes')
const usuariosRoutes = require('./modules/usuarios/usuarios.routes')
const produtoresRoutes = require('./modules/produtores/produtores.routes')
const cargasRoutes = require('./modules/cargas/cargas.routes')
const motoristasRoutes = require('./modules/motoristas/motoristas.routes')
const avaliacoesRoutes = require('./modules/avaliacoes/avaliacoes.routes')
const qualidadeRoutes = require('./modules/qualidade/qualidade.routes')
const pagamentosRoutes = require('./modules/pagamentos/pagamentos.routes')
const sincronizacaoRoutes = require('./modules/sincronizacao/sincronizacao.routes')
const auditoriaRoutes = require('./modules/auditoria/auditoria.routes')

const app = express()

app.use(cors())            // libera o React (que roda em outra porta) a chamar esta API
app.use(express.json())    // ensina o Express a ler corpo de requisição em JSON

app.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ status: 'ok', banco: 'conectado', horario: new Date() })
})

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/produtores', produtoresRoutes)
app.use('/api/cargas', cargasRoutes)
app.use('/api/motoristas', motoristasRoutes)
app.use('/api/avaliacoes', avaliacoesRoutes)
app.use('/api/qualidade', qualidadeRoutes)
app.use('/api/pagamentos', pagamentosRoutes)
app.use('/api/sincronizacao', sincronizacaoRoutes)
app.use('/api/auditoria', auditoriaRoutes)

app.use(
  '/uploads',
  express.static(PASTA_UPLOADS, {
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
)

app.use(naoEncontrado)
app.use(tratarErros)

module.exports = { app }
