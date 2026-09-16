const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config/env')

function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization

  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({
      erro: 'Não autenticado',
      detalhe: 'Envie o token no cabeçalho Authorization: Bearer <token>.',
    })
  }

  const token = cabecalho.substring(7) // remove o "Bearer "

  try {
    const dados = jwt.verify(token, JWT_SECRET)

    req.usuario = {
      id: dados.sub,      // "sub" (subject) é onde o padrão JWT guarda o id
      nome: dados.nome,
      perfil: dados.perfil,
    }

    return next()
  } catch (e) {
    const expirou = e.name === 'TokenExpiredError'
    return res.status(401).json({
      erro: expirou ? 'Sessão expirada' : 'Token inválido',
      detalhe: expirou ? 'Faça login novamente.' : 'O token enviado não é válido.',
    })
  }
}

module.exports = { autenticar }
