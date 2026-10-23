const servico = require('./auth.service')
const { registrar, ACOES } = require('../../lib/auditoria')

async function login(req, res) {
  const { usuario, senha } = req.body
  const resultado = await servico.entrar(usuario, senha)
  res.json(resultado)
}

async function eu(req, res) {
  res.json({ usuario: req.usuario })
}

async function trocarSenha(req, res) {
  const { senhaAtual, senhaNova } = req.body
  const resultado = await servico.trocarPropriaSenha(req.usuario.id, senhaAtual, senhaNova)

  // a senha em si nunca vai para o registro, só o fato de ter sido trocada
  await registrar(req, {
    acao: ACOES.SENHA_TROCADA,
    entidade: 'Usuario',
    entidadeId: req.usuario.id,
    alvo: req.usuario.nome,   // o token não traz o login, só o nome
  })

  res.json(resultado)
}

module.exports = { login, eu, trocarSenha }
