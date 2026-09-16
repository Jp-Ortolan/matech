const PERFIS = [
  'OPERADOR_BALANCA',
  'ANALISTA_QUALIDADE',
  'COMPRADOR_AVALIADOR',
  'ADMINISTRATIVO',
  'ADMINISTRADOR',
]

const IRRESTRITOS = ['ADMINISTRATIVO', 'ADMINISTRADOR']

function podeNegocio(perfil, ...perfisAutorizados) {
  return new Set([...perfisAutorizados, ...IRRESTRITOS]).has(perfil)
}

function conferir(autorizados) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado' })
    }

    if (!autorizados.has(req.usuario.perfil)) {
      return res.status(403).json({
        erro: 'Sem permissão',
        detalhe: `O perfil ${req.usuario.perfil} não pode executar esta operação.`,
        perfisPermitidos: [...autorizados],
      })
    }

    return next()
  }
}

function permitir(...perfisAutorizados) {
  return conferir(new Set([...perfisAutorizados, ...IRRESTRITOS]))
}

function apenas(...perfisAutorizados) {
  return conferir(new Set(perfisAutorizados))
}

module.exports = { permitir, apenas, podeNegocio, PERFIS, IRRESTRITOS }
