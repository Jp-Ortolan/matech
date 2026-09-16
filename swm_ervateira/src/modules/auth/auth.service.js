const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { prisma } = require('../../lib/prisma')
const { JWT_SECRET, JWT_EXPIRA_EM } = require('../../config/env')
const { ErroDeNegocio } = require('../../middlewares/erros')

async function entrar(usuario, senha) {
  if (!usuario || !senha) {
    throw new ErroDeNegocio('Informe usuário e senha', 400)
  }

  const encontrado = await prisma.usuario.findUnique({ where: { usuario } })

  const generico = () => new ErroDeNegocio('Usuário ou senha inválidos', 401)

  if (!encontrado) throw generico()
  if (!encontrado.ativo) throw new ErroDeNegocio('Usuário inativo', 403)

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

function gerarToken(usuario) {
  return jwt.sign(
    { nome: usuario.nome, perfil: usuario.perfil },
    JWT_SECRET,
    { subject: usuario.id, expiresIn: JWT_EXPIRA_EM }
  )
}

async function gerarHash(senha) {
  return bcrypt.hash(senha, 10)
}

async function trocarPropriaSenha(id, senhaAtual, senhaNova) {
  if (!senhaAtual || !senhaNova) {
    throw new ErroDeNegocio('Informe a senha atual e a nova', 400)
  }
  if (String(senhaNova).length < 6) {
    throw new ErroDeNegocio('A senha nova precisa ter ao menos 6 caracteres', 400)
  }
  if (senhaAtual === senhaNova) {
    throw new ErroDeNegocio('A senha nova precisa ser diferente da atual', 400)
  }

  const encontrado = await prisma.usuario.findUnique({ where: { id } })
  if (!encontrado) throw new ErroDeNegocio('Usuário não encontrado', 404)

  const confere = await bcrypt.compare(senhaAtual, encontrado.senhaHash)
  if (!confere) throw new ErroDeNegocio('A senha atual está incorreta', 400)

  await prisma.usuario.update({
    where: { id },
    data: { senhaHash: await gerarHash(senhaNova) },
  })

  return { trocada: true }
}

module.exports = { entrar, gerarToken, gerarHash, trocarPropriaSenha }
