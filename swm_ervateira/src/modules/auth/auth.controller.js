// ---------------------------------------------------------------------------
// CONTROLADOR · autenticação
// ---------------------------------------------------------------------------
// O CONTROLADOR é a ponte entre o mundo HTTP e as regras de negócio.
// Ele só faz três coisas:
//   1. pega o que veio na requisição (corpo, parâmetros, usuário logado)
//   2. chama o serviço, que é quem sabe a regra
//   3. devolve a resposta com o código HTTP certo
//
// Ele NÃO deve conter regra de negócio. Se você vir um "if" decidindo algo
// sobre o negócio aqui, ele está no lugar errado — pertence ao serviço.

const servico = require('./auth.service')

// POST /api/auth/login
async function login(req, res) {
  const { usuario, senha } = req.body
  const resultado = await servico.entrar(usuario, senha)
  res.json(resultado)
}

// GET /api/auth/eu
// Devolve os dados de quem está com o token. A web usa isso ao abrir o
// sistema, para saber qual nome mostrar na barra superior e quais itens
// de menu liberar.
async function eu(req, res) {
  res.json({ usuario: req.usuario })
}

module.exports = { login, eu }
