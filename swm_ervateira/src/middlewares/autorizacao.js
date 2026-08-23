// ---------------------------------------------------------------------------
// MIDDLEWARE · autorização (você pode fazer isso?)
// ---------------------------------------------------------------------------
// A autenticação diz QUEM é o usuário. A autorização diz o que ele PODE fazer.
// São coisas diferentes e por isso ficam em arquivos diferentes.
//
// Atende ao RF15 e ao RNF04: o sistema tem quatro perfis, e cada um enxerga
// apenas o que lhe cabe, conforme a matriz de permissões da tela de
// Configurações do protótipo.
//
// Uso na rota:
//     router.post('/', autenticar, permitir('OPERADOR_BALANCA'), controlador)
//
// O ADMINISTRATIVO passa em tudo, por isso está sempre incluído.

const PERFIS = [
  'OPERADOR_BALANCA',
  'ANALISTA_QUALIDADE',
  'COMPRADOR_AVALIADOR',
  'ADMINISTRATIVO',
]

function permitir(...perfisAutorizados) {
  const autorizados = new Set([...perfisAutorizados, 'ADMINISTRATIVO'])

  return function (req, res, next) {
    // Se este middleware rodar sem o autenticar antes, req.usuario não existe.
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

module.exports = { permitir, PERFIS }
