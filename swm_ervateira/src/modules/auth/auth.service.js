// ---------------------------------------------------------------------------
// SERVIÇO · autenticação
// ---------------------------------------------------------------------------
// O SERVIÇO guarda as regras de negócio. Ele não sabe o que é uma requisição
// HTTP: não conhece req, nem res, nem código 200 ou 401. Só recebe dados,
// aplica a regra e devolve o resultado — ou lança um erro.
//
// Essa separação é o que permite testar a regra sem subir o servidor, e é a
// mesma ideia que deixa o cálculo de pagamento testável no Quadro 8 do artigo.

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { prisma } = require('../../lib/prisma')
const { JWT_SECRET, JWT_EXPIRA_EM } = require('../../config/env')
const { ErroDeNegocio } = require('../../middlewares/erros')

/**
 * Confere usuário e senha e devolve o token de acesso.
 */
async function entrar(usuario, senha) {
  if (!usuario || !senha) {
    throw new ErroDeNegocio('Informe usuário e senha', 400)
  }

  const encontrado = await prisma.usuario.findUnique({ where: { usuario } })

  // Importante: a mensagem é a mesma para "usuário não existe" e para
  // "senha errada". Se fossem diferentes, alguém poderia descobrir quais
  // usuários existem no sistema testando nomes.
  const generico = () => new ErroDeNegocio('Usuário ou senha inválidos', 401)

  if (!encontrado) throw generico()
  if (!encontrado.ativo) throw new ErroDeNegocio('Usuário inativo', 403)

  // compare() refaz o hash da senha digitada e compara com o hash guardado.
  // A senha original nunca é armazenada em lugar nenhum.
  const confere = await bcrypt.compare(senha, encontrado.senhaHash)
  if (!confere) throw generico()

  await prisma.usuario.update({
    where: { id: encontrado.id },
    data: { ultimoAcesso: new Date() },
  })

  const token = gerarToken(encontrado)

  return {
    token,
    usuario: {
      id: encontrado.id,
      nome: encontrado.nome,
      usuario: encontrado.usuario,
      perfil: encontrado.perfil,
    },
  }
}

/**
 * Monta o token JWT. O conteúdo (payload) vai aberto dentro do token —
 * qualquer um consegue ler. Por isso só entram dados não sensíveis.
 * O que protege é a ASSINATURA: sem a chave secreta ninguém consegue
 * alterar o conteúdo sem invalidar o token.
 */
function gerarToken(usuario) {
  return jwt.sign(
    { nome: usuario.nome, perfil: usuario.perfil },
    JWT_SECRET,
    { subject: usuario.id, expiresIn: JWT_EXPIRA_EM }
  )
}

/**
 * Gera o hash de uma senha nova. Usado no cadastro de usuários e no seed.
 * O número 10 é o "custo": quanto maior, mais lento de calcular — e mais
 * caro fica para alguém tentar quebrar a senha por força bruta.
 */
async function gerarHash(senha) {
  return bcrypt.hash(senha, 10)
}

module.exports = { entrar, gerarToken, gerarHash }
