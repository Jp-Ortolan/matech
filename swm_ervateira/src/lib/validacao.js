// Regras de formato e faixa usadas pela web e pela sincronização do app.
// Tudo o que chega do cliente passa por aqui antes de ir para o banco.
const { ErroDeNegocio } = require('../middlewares/erros')
const { lerNumero, estaVazio, DICA_FORMATO } = require('./numeros')

// Faixas plausíveis (decisão do negócio).
const FAIXAS = {
  pesoBrutoKg: { min: 1000, max: 80000 },   // caminhão carregado
  taraKg: { min: 1000 },                     // caminhão vazio
  pesoEstimadoKg: { max: 100000 },           // mesmo teto do app
  precoKg: { max: 100 },                     // mesmo teto do app
  idadeAnos: { min: 1, max: 100 },
}

const kg = (n) => `${n.toLocaleString('pt-BR')} kg`

// Lê um número e confere a faixa. Vazio devolve null (ou recusa, se obrigatório).
function numeroNaFaixa(valor, { rotulo, min, max, obrigatorio = false, inteiro = false, unidade = '' }) {
  if (estaVazio(valor)) {
    if (obrigatorio) throw new ErroDeNegocio(`Informe ${rotulo}`, 400)
    return null
  }
  const n = lerNumero(valor)
  if (!Number.isFinite(n)) throw new ErroDeNegocio(`${primeiraMaiuscula(rotulo)} precisa ser um número`, 400, DICA_FORMATO)
  if (inteiro && !Number.isInteger(n)) throw new ErroDeNegocio(`${primeiraMaiuscula(rotulo)} precisa ser um número inteiro`, 400)
  if (min !== undefined && n < min) throw new ErroDeNegocio(`${primeiraMaiuscula(rotulo)} deve ser de pelo menos ${min.toLocaleString('pt-BR')}${unidade}`, 400)
  if (max !== undefined && n > max) throw new ErroDeNegocio(`${primeiraMaiuscula(rotulo)} deve ser de no máximo ${max.toLocaleString('pt-BR')}${unidade}`, 400, 'Confira se não sobrou algum dígito.')
  return n
}

const primeiraMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// Listas fechadas (iguais aos enums do schema.prisma).
const LISTAS = {
  tipoMateriaPrima: ['ERVA_MATE_PLANTADA', 'ERVA_MATE_NATIVA', 'PALITO', 'LENHA'],
  tipoErva: ['PLANTADA', 'NATIVA'],
  ervaQueimada: ['NAO', 'EM_PARTE', 'SIM'],
  classificacao: ['A', 'B', 'C'],
  formaPagamento: ['PIX', 'CONTA_BANCARIA', 'DINHEIRO'],
  tipoConta: ['CORRENTE', 'POUPANCA'],
  tipoChavePix: ['CPF', 'TELEFONE', 'EMAIL', 'ALEATORIA'],
  situacaoCarga: ['AGUARDANDO_TARA', 'AGUARDANDO_ANALISE', 'ANALISADA', 'EM_ORDEM_PAGAMENTO', 'PAGA', 'REPROVADA'],
  situacaoOrdem: ['PENDENTE', 'PAGA', 'CANCELADA'],
}

// Confere se o valor está na lista. Vazio devolve o padrão (ou null).
function daLista(valor, lista, rotulo, padrao = null) {
  if (estaVazio(valor)) return padrao
  if (!LISTAS[lista].includes(valor)) {
    throw new ErroDeNegocio(`Valor inválido para ${rotulo}`, 400, `Use um destes: ${LISTAS[lista].join(', ')}.`)
  }
  return valor
}

// Lê uma data. Recusa texto que não é data e, se pedido, data no futuro.
// Um dia de folga cobre relógio de aparelho um pouco adiantado.
const UM_DIA = 24 * 60 * 60 * 1000
function lerData(valor, rotulo, { obrigatoria = false, semFuturo = false } = {}) {
  if (estaVazio(valor)) {
    if (obrigatoria) throw new ErroDeNegocio(`Informe ${rotulo}`, 400)
    return null
  }
  const data = new Date(valor)
  if (isNaN(data)) throw new ErroDeNegocio(`Data inválida em ${rotulo}`, 400)
  if (data.getFullYear() < 2000 || data.getFullYear() > 2100) {
    throw new ErroDeNegocio(`Data fora do período aceito em ${rotulo}`, 400)
  }
  if (semFuturo && data.getTime() > Date.now() + UM_DIA) {
    throw new ErroDeNegocio(`${primeiraMaiuscula(rotulo)} não pode estar no futuro`, 400)
  }
  return data
}

// Página e tamanho de página sempre positivos.
function paginacao(query = {}, { padrao = 20, maximo = 200 } = {}) {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1)
  const porPagina = Math.min(Math.max(1, parseInt(query.porPagina, 10) || padrao), maximo)
  return { pagina, porPagina }
}

// Latitude e longitude: fora do globo vira erro, vazio vira null.
function coordenada(valor, tipo) {
  const limite = tipo === 'latitude' ? 90 : 180
  return numeroNaFaixa(valor, { rotulo: `a ${tipo}`, min: -limite, max: limite })
}

module.exports = { FAIXAS, kg, numeroNaFaixa, LISTAS, daLista, lerData, paginacao, coordenada }
