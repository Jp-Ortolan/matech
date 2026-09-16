const { prisma } = require('../../lib/prisma')
const { gerarHash } = require('../auth/auth.service')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { PERFIS } = require('../../middlewares/autorizacao')

const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  usuario: true,
  perfil: true,
  ativo: true,
  ultimoAcesso: true,
  criadoEm: true,
}

const MINIMO_SENHA = 6

function validarPerfil(perfil) {
  if (!PERFIS.includes(perfil)) {
    throw new ErroDeNegocio(`Perfil inválido: ${perfil}`, 400)
  }
}

function validarSenha(senha) {
  if (!senha || String(senha).length < MINIMO_SENHA) {
    throw new ErroDeNegocio(`A senha precisa ter ao menos ${MINIMO_SENHA} caracteres`, 400)
  }
}

function normalizarLogin(usuario) {
  const limpo = String(usuario ?? '').trim().toLowerCase()
  if (limpo.length < 3) {
    throw new ErroDeNegocio('O nome de usuário precisa ter ao menos 3 caracteres', 400)
  }
  if (!/^[a-z0-9._-]+$/.test(limpo)) {
    throw new ErroDeNegocio('O nome de usuário aceita apenas letras, números, ponto, hífen e sublinhado', 400)
  }
  return limpo
}

async function listar() {
  const usuarios = await prisma.usuario.findMany({
    select: CAMPOS_PUBLICOS,
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  })
  return { total: usuarios.length, usuarios }
}

async function obter(id) {
  return prisma.usuario.findUnique({ where: { id }, select: CAMPOS_PUBLICOS })
}

async function criar({ nome, usuario, senha, perfil, ativo = true }) {
  if (!nome || String(nome).trim().length < 3) {
    throw new ErroDeNegocio('Informe o nome completo', 400)
  }
  validarPerfil(perfil)
  validarSenha(senha)

  return prisma.usuario.create({
    data: {
      nome: String(nome).trim(),
      usuario: normalizarLogin(usuario),
      senhaHash: await gerarHash(senha),
      perfil,
      ativo: Boolean(ativo),
    },
    select: CAMPOS_PUBLICOS,
  })
}

async function atualizar(id, { nome, perfil, ativo }, quemPede) {
  const dados = {}

  if (nome !== undefined) {
    if (String(nome).trim().length < 3) throw new ErroDeNegocio('Informe o nome completo', 400)
    dados.nome = String(nome).trim()
  }

  if (perfil !== undefined) {
    validarPerfil(perfil)
    if (id === quemPede && perfil !== 'ADMINISTRADOR') {
      throw new ErroDeNegocio('Você não pode retirar o próprio perfil de administrador', 400)
    }
    dados.perfil = perfil
  }

  if (ativo !== undefined) {
    if (id === quemPede && !ativo) {
      throw new ErroDeNegocio('Você não pode desativar a própria conta', 400)
    }
    dados.ativo = Boolean(ativo)
  }

  if (Object.keys(dados).length === 0) throw new ErroDeNegocio('Nada a atualizar', 400)

  return prisma.usuario.update({ where: { id }, data: dados, select: CAMPOS_PUBLICOS })
}

async function redefinirSenha(id, senha) {
  validarSenha(senha)
  return prisma.usuario.update({
    where: { id },
    data: { senhaHash: await gerarHash(senha) },
    select: CAMPOS_PUBLICOS,
  })
}

module.exports = {
  listar, obter, criar, atualizar, redefinirSenha,
  normalizarLogin, validarPerfil, validarSenha,
  CAMPOS_PUBLICOS, MINIMO_SENHA,
}
