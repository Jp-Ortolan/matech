class ErroDeNegocio extends Error {
  constructor(mensagem, status = 400, detalhe) {
    super(mensagem)
    this.status = status
    this.detalhe = detalhe
  }
}

function naoEncontrado(req, res) {
  res.status(404).json({
    erro: 'Rota não encontrada',
    detalhe: `${req.method} ${req.originalUrl} não existe nesta API.`,
  })
}

function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroDeNegocio) {
    return res.status(erro.status).json({ erro: erro.message, detalhe: erro.detalhe })
  }

  if (erro.code === 'P2002') {
    return res.status(409).json({
      erro: 'Registro duplicado',
      detalhe: `Já existe um registro com este valor em: ${erro.meta?.target}.`,
    })
  }
  if (erro.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado' })
  }
  if (erro.code === 'P2003') {
    return res.status(400).json({
      erro: 'Registro relacionado não encontrado',
      detalhe: `O campo ${erro.meta?.field_name ?? 'informado'} aponta para um registro que não existe.`,
    })
  }

  console.error('[erro não tratado]', erro)
  return res.status(500).json({ erro: 'Erro interno no servidor' })
}

module.exports = { ErroDeNegocio, naoEncontrado, tratarErros }
