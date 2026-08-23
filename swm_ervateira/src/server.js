// ---------------------------------------------------------------------------
// SERVIDOR · ponto de entrada
// ---------------------------------------------------------------------------
// Este é o arquivo que o "npm run dev" executa. Ele tem uma responsabilidade
// só: pegar a aplicação já montada e colocá-la para escutar numa porta.

const { app } = require('./app')
const { PORT } = require('./config/env')
const { prisma } = require('./lib/prisma')

const servidor = app.listen(PORT, () => {
  console.log('')
  console.log('  MATECH · API de gestão de matéria-prima')
  console.log(`  no ar em  http://localhost:${PORT}`)
  console.log(`  saúde     http://localhost:${PORT}/health`)
  console.log('')
})

// Encerramento organizado: quando você aperta Ctrl+C, fecha a conexão com o
// banco antes de sair, em vez de largar a conexão pendurada.
async function encerrar(sinal) {
  console.log(`\n${sinal} recebido. Encerrando...`)
  servidor.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', () => encerrar('SIGINT'))
process.on('SIGTERM', () => encerrar('SIGTERM'))
