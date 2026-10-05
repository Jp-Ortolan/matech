const express = require('express')
const cors = require('cors')

const { prisma } = require('./lib/prisma')
const fs = require('node:fs')
const path = require('node:path')
const { PASTA_UPLOADS, PRODUCAO, CORS_ORIGENS } = require('./config/env')
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
const aparelhosRoutes = require('./modules/aparelhos/aparelhos.routes')
const auditoriaRoutes = require('./modules/auditoria/auditoria.routes')

const app = express()

// Em desenvolvimento libera tudo (o React roda em outra porta).
// Em produção só os endereços de CORS_ORIGENS.
app.use(cors({ origin: PRODUCAO ? CORS_ORIGENS : true }))
app.use(express.json())    // ensina o Express a ler corpo de requisição em JSON

app.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ status: 'ok', banco: 'conectado', horario: new Date() })
})

// Documentação da API (Swagger): /api/docs
const documentacao = require('./docs/openapi')
const especificacao = documentacao.montar()
app.get('/api/docs/openapi.json', (req, res) => res.json(especificacao))
app.get('/api/docs', (req, res) => res.type('html').send(documentacao.PAGINA))

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/produtores', produtoresRoutes)
app.use('/api/cargas', cargasRoutes)
app.use('/api/motoristas', motoristasRoutes)
app.use('/api/avaliacoes', avaliacoesRoutes)
app.use('/api/qualidade', qualidadeRoutes)
app.use('/api/pagamentos', pagamentosRoutes)
app.use('/api/sincronizacao', sincronizacaoRoutes)
app.use('/api/aparelhos', aparelhosRoutes)
app.use('/api/auditoria', auditoriaRoutes)

// Foto guardada no banco. As antigas, gravadas em disco, seguem pelo static abaixo.
app.get('/uploads/fotos/:arquivo', async (req, res, next) => {
  const foto = await prisma.fotoErval.findFirst({
    where: { caminho: `fotos/${req.params.arquivo}` },
    select: { dados: true, tipoMime: true },
  })
  if (!foto?.dados) return next()
  res.set({
    'Content-Type': foto.tipoMime || 'application/octet-stream',
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  })
  res.send(Buffer.from(foto.dados))
})

app.use(
  '/uploads',
  express.static(PASTA_UPLOADS, {
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
)

// Web publicada: a API serve o build do React (web/dist), no mesmo endereço.
// Assim a web chama /api sem precisar saber onde a API está.
const PASTA_WEB = path.join(__dirname, '..', 'web', 'dist')
if (fs.existsSync(PASTA_WEB)) {
  app.use(express.static(PASTA_WEB, { index: false }))
  app.use((req, res, next) => {
    const ehDaApi = req.path.startsWith('/api') || req.path.startsWith('/uploads')
    if (req.method !== 'GET' || ehDaApi) return next()
    res.sendFile(path.join(PASTA_WEB, 'index.html'))
  })
}

app.use(naoEncontrado)
app.use(tratarErros)

module.exports = { app }
