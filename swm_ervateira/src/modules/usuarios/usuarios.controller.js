const servico = require('./usuarios.service')
const { registrar, diferencas, descreverUsuario, ACOES } = require('../../lib/auditoria')

async function listar(req, res) {
  res.json(await servico.listar())
}

async function criar(req, res) {
  const { nome, usuario, senha, perfil, ativo } = req.body
  const criado = await servico.criar({ nome, usuario, senha, perfil, ativo })

  await registrar(req, {
    acao: ACOES.USUARIO_CRIADO,
    entidade: 'Usuario',
    entidadeId: criado.id,
    alvo: descreverUsuario(criado),
    depois: { nome: criado.nome, usuario: criado.usuario, perfil: criado.perfil, ativo: criado.ativo },
  })

  res.status(201).json(criado)
}

async function atualizar(req, res) {
  const { nome, perfil, ativo } = req.body

  const antes = await servico.obter(req.params.id)

  const depois = await servico.atualizar(req.params.id, { nome, perfil, ativo }, req.usuario.id)

  const mudou = diferencas(
    { nome: antes?.nome, perfil: antes?.perfil, ativo: antes?.ativo },
    { nome: depois.nome, perfil: depois.perfil, ativo: depois.ativo }
  )
  if (mudou) {
    await registrar(req, {
      acao: ACOES.USUARIO_ALTERADO,
      entidade: 'Usuario',
      entidadeId: depois.id,
      alvo: descreverUsuario(depois),
      antes: mudou.antes,
      depois: mudou.depois,
    })
  }

  res.json(depois)
}

async function redefinirSenha(req, res) {
  const atualizado = await servico.redefinirSenha(req.params.id, req.body?.senha)

  await registrar(req, {
    acao: ACOES.SENHA_REDEFINIDA,
    entidade: 'Usuario',
    entidadeId: atualizado.id,
    alvo: descreverUsuario(atualizado),
  })

  res.json(atualizado)
}

module.exports = { listar, criar, atualizar, redefinirSenha }
