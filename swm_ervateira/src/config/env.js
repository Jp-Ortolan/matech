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

module.exports = {
  DATABASE_URL: obrigatoria('DATABASE_URL'),

  PORT: Number(process.env.PORT || 3000),

  JWT_SECRET: obrigatoria('JWT_SECRET'),

  JWT_EXPIRA_EM: process.env.JWT_EXPIRA_EM || '8h',

  PASTA_UPLOADS: process.env.PASTA_UPLOADS || path.join(__dirname, '..', '..', 'uploads'),
}
