// ---------------------------------------------------------------------------
// CONFIGURAÇÃO · variáveis de ambiente
// ---------------------------------------------------------------------------
// Este arquivo é o único lugar do sistema que lê o arquivo .env.
// Todo o resto do código importa daqui.
//
// Por que centralizar: se amanhã a senha do banco mudar de lugar, ou o sistema
// for para um servidor, só este arquivo muda. E, se faltar uma variável
// obrigatória, o servidor avisa na hora de subir em vez de quebrar no meio de
// uma requisição.

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
  // Linha de conexão com o PostgreSQL
  DATABASE_URL: obrigatoria('DATABASE_URL'),

  // Porta em que a API escuta
  PORT: Number(process.env.PORT || 3000),

  // Chave usada para assinar os tokens JWT.
  // Quem tiver essa chave consegue forjar um token, por isso ela fica no .env
  // e o .env está no .gitignore — nunca vai para o GitHub.
  JWT_SECRET: obrigatoria('JWT_SECRET'),

  // Por quanto tempo o token continua válido depois do login
  JWT_EXPIRA_EM: process.env.JWT_EXPIRA_EM || '8h',

  // Onde ficam as fotos que o aplicativo envia do erval.
  // Fica FORA de src/ de propósito: é dado de usuário, não código — e por
  // isso está no .gitignore, como o .env.
  PASTA_UPLOADS: process.env.PASTA_UPLOADS || path.join(__dirname, '..', '..', 'uploads'),
}
