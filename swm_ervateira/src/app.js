// ---------------------------------------------------------------------------
// APLICAÇÃO · montagem do Express
// ---------------------------------------------------------------------------
// Este arquivo monta a aplicação e junta os módulos, mas NÃO sobe o servidor.
// Quem sobe é o server.js.
//
// Por que separar: assim os testes automatizados conseguem importar o app e
// disparar requisições sem ocupar a porta 3000. É o que vai permitir os testes
// funcionais previstos no Quadro 8.
//
// A ORDEM importa. O Express executa os middlewares de cima para baixo:
//   1. cors e json      → preparam a requisição
//   2. rotas            → atendem
//   3. naoEncontrado    → nada atendeu, é 404
//   4. tratarErros      → alguém lançou erro, vira JSON

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
const parametrosRoutes = require('./modules/parametros/parametros.routes')

const app = express()

app.use(cors())            // libera o React (que roda em outra porta) a chamar esta API
app.use(express.json())    // ensina o Express a ler corpo de requisição em JSON

// Verificação de saúde: confirma que a API responde E que o banco está acessível.
app.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ status: 'ok', banco: 'conectado', horario: new Date() })
})

// Cada módulo cuida do seu pedaço da API.
app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/produtores', produtoresRoutes)
app.use('/api/cargas', cargasRoutes)
app.use('/api/motoristas', motoristasRoutes)
app.use('/api/avaliacoes', avaliacoesRoutes)
app.use('/api/qualidade', qualidadeRoutes)
app.use('/api/pagamentos', pagamentosRoutes)
app.use('/api/sincronizacao', sincronizacaoRoutes)
app.use('/api/parametros', parametrosRoutes)

// As fotos enviadas pelo aplicativo ficam acessíveis por URL, para que a web
// consiga exibi-las. express.static é do próprio Express — nenhuma biblioteca
// nova entrou no projeto por causa de upload.
app.use('/uploads', express.static(PASTA_UPLOADS))

app.use(naoEncontrado)
app.use(tratarErros)

module.exports = { app }
