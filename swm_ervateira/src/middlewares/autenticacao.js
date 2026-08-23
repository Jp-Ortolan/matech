// ---------------------------------------------------------------------------
// MIDDLEWARE · autenticação (quem é você?)
// ---------------------------------------------------------------------------
// Um "middleware" é uma função que roda ANTES do controlador da rota.
// Ela recebe (req, res, next): se estiver tudo certo chama next() e a
// requisição segue; se não, responde com erro e a requisição para ali.
//
// Este confere o token JWT que o aplicativo ou a web enviam no cabeçalho:
//     Authorization: Bearer <token>
//
// Se o token for válido, guarda os dados do usuário em req.usuario, para que
// os controladores saibam quem está fazendo a operação — é assim que a carga
// fica registrada no nome do operador certo.

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
    // verify() confere a assinatura e a validade. Se o token foi alterado
    // ou já expirou, ele lança um erro.
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
