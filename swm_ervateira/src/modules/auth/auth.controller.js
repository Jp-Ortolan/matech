const servico = require('./auth.service')

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
  res.json(await servico.trocarPropriaSenha(req.usuario.id, senhaAtual, senhaNova))
}

module.exports = { login, eu, trocarSenha }
