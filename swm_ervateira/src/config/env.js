require('dotenv/config')
const path = require('node:path')

function obrigatoria(nome, padrao) {
  const valor = process.env[nome] ?? padrao
  if (!valor) {
    throw new Error(
      `A variável ${nome} não está definida no arquivo .env. ` +
      `O servidor não pode subir sem ela.`
    )
  }
  return valor
}

const PRODUCAO = process.env.NODE_ENV === 'production'

// Em produção a chave dos tokens precisa ser longa: com uma chave curta,
// alguém conseguiria forjar um login de administrador.
if (PRODUCAO && String(process.env.JWT_SECRET || '').length < 32) {
  throw new Error('Em produção, JWT_SECRET precisa ter pelo menos 32 caracteres.')
}

module.exports = {
  PRODUCAO,

  DATABASE_URL: obrigatoria('DATABASE_URL'),

  PORT: Number(process.env.PORT || 3000),

  JWT_SECRET: obrigatoria('JWT_SECRET'),

  JWT_EXPIRA_EM: process.env.JWT_EXPIRA_EM || '8h',

  PASTA_UPLOADS: process.env.PASTA_UPLOADS || path.join(__dirname, '..', '..', 'uploads'),

  // Sites que podem chamar a API de outro endereço, separados por vírgula.
  // A web publicada é servida pela própria API e o app não usa CORS,
  // então em produção a lista pode ficar vazia.
  CORS_ORIGENS: (process.env.CORS_ORIGENS || '').split(',').map((o) => o.trim()).filter(Boolean),
}
