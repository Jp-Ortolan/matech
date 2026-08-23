// ---------------------------------------------------------------------------
// MIDDLEWARE · tratamento de erros
// ---------------------------------------------------------------------------
// Fica no FIM da lista de middlewares e recebe quatro argumentos
// (erro, req, res, next) — é essa assinatura de quatro que faz o Express
// entender que ele é um tratador de erros.
//
// Sem isto, um erro inesperado devolveria uma página HTML de erro do Express,
// que o React e o Flutter não sabem ler. Aqui tudo vira JSON com o mesmo
// formato, o que simplifica muito o lado do cliente.

// Erro que o próprio sistema lança de propósito, quando uma regra de negócio
// não foi cumprida. Ex.: "essa carga já tem análise registrada".
class ErroDeNegocio extends Error {
  constructor(mensagem, status = 400, detalhe) {
    super(mensagem)
    this.status = status
    this.detalhe = detalhe
  }
}

// Rota que não existe
function naoEncontrado(req, res) {
  res.status(404).json({
    erro: 'Rota não encontrada',
    detalhe: `${req.method} ${req.originalUrl} não existe nesta API.`,
  })
}

function tratarErros(erro, req, res, next) {
  // Erros que nós mesmos lançamos: a mensagem pode ir para o usuário.
  if (erro instanceof ErroDeNegocio) {
    return res.status(erro.status).json({ erro: erro.message, detalhe: erro.detalhe })
  }

  // Erros conhecidos do Prisma que valem uma mensagem melhor.
  // P2002 = violação de campo único (ex.: CPF já cadastrado)
  if (erro.code === 'P2002') {
    return res.status(409).json({
      erro: 'Registro duplicado',
      detalhe: `Já existe um registro com este valor em: ${erro.meta?.target}.`,
    })
  }
  // P2025 = tentou atualizar ou apagar algo que não existe
  if (erro.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado' })
  }

  // Qualquer outra coisa é falha nossa: registra no terminal para investigar
  // e devolve uma mensagem genérica, sem expor detalhes internos.
  console.error('[erro não tratado]', erro)
  return res.status(500).json({ erro: 'Erro interno no servidor' })
}

module.exports = { ErroDeNegocio, naoEncontrado, tratarErros }
