const { randomUUID } = require('node:crypto')

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

// Nome do campo que o Prisma recusou (ex.: "Argument `tipoErva`").
function campoRecusado(erro) {
  const achado = String(erro.message || '').match(/[Aa]rgument `(\w+)`/)
  return achado ? achado[1] : null
}

// Transforma um erro conhecido em { status, erro, detalhe }.
// Devolve null quando o erro é inesperado (vira 500).
function traduzirErro(erro) {
  if (erro instanceof ErroDeNegocio) {
    return { status: erro.status, erro: erro.message, detalhe: erro.detalhe }
  }

  // Erros do leitor de JSON do Express.
  if (erro.type === 'entity.parse.failed') {
    return { status: 400, erro: 'O corpo da requisição não é um JSON válido', detalhe: 'Confira aspas, vírgulas e chaves.' }
  }
  if (erro.type === 'entity.too.large') {
    return { status: 413, erro: 'Os dados enviados são grandes demais' }
  }
  if (erro.status >= 400 && erro.status < 500 && erro.expose) {
    return { status: erro.status, erro: erro.message }
  }

  // Erros do Prisma.
  if (erro.name === 'PrismaClientValidationError') {
    const campo = campoRecusado(erro)
    return {
      status: 400,
      erro: 'Dado em formato inválido',
      detalhe: campo ? `Confira o campo ${campo}.` : 'Algum campo veio com tipo ou valor que o sistema não aceita.',
    }
  }
  switch (erro.code) {
    case 'P2000':
      return { status: 400, erro: 'Texto longo demais', detalhe: 'Algum campo passou do tamanho que o banco guarda.' }
    case 'P2002':
      return { status: 409, erro: 'Registro duplicado', detalhe: `Já existe um registro com este valor em: ${erro.meta?.target}.` }
    case 'P2003':
      return {
        status: 400,
        erro: 'Registro relacionado não encontrado',
        detalhe: `O campo ${erro.meta?.field_name ?? 'informado'} aponta para um registro que não existe.`,
      }
    case 'P2007':
    case 'P2023':
      return { status: 400, erro: 'Dado em formato inválido', detalhe: 'Confira identificadores e datas enviados.' }
    case 'P2020':
      return { status: 400, erro: 'Número grande demais', detalhe: 'Confira se não sobrou algum dígito.' }
    case 'P2025':
      return { status: 404, erro: 'Registro não encontrado' }
    default:
      return null
  }
}

function tratarErros(erro, req, res, next) {
  const conhecido = traduzirErro(erro)
  if (conhecido) {
    const { status, ...corpo } = conhecido
    return res.status(status).json(corpo)
  }

  // Erro inesperado: o código liga a resposta à linha do log do servidor.
  const codigo = randomUUID().slice(0, 8)
  console.error(`[erro não tratado ${codigo}] ${req.method} ${req.originalUrl}`, erro)
  return res.status(500).json({
    erro: 'Erro interno no servidor',
    detalhe: `Algo inesperado falhou. Informe o código ${codigo} ao suporte.`,
    codigo,
  })
}

module.exports = { ErroDeNegocio, naoEncontrado, traduzirErro, tratarErros }
