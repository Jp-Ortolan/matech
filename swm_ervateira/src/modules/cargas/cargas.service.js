const { prisma } = require('../../lib/prisma')
const { valorDaCarga } = require('../../lib/dinheiro')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { lerNumero, estaVazio, DICA_FORMATO } = require('../../lib/numeros')
const { FAIXAS, numeroNaFaixa, daLista, lerData } = require('../../lib/validacao')
const { erroNosTextos } = require('../../lib/textos')

// Peso bruto: maior que zero e dentro da faixa de um caminhão carregado.
function validarPesoBruto(valor) {
  const bruto = lerNumero(valor)
  if (!Number.isFinite(bruto)) throw new ErroDeNegocio('O peso bruto precisa ser um número', 400, DICA_FORMATO)
  if (!(bruto > 0)) throw new ErroDeNegocio('O peso bruto deve ser maior que zero', 400)
  return numeroNaFaixa(bruto, { rotulo: 'o peso bruto', ...FAIXAS.pesoBrutoKg, unidade: ' kg' })
}

function calcularPesoLiquido(pesoBrutoKg, taraKg) {
  const bruto = lerNumero(pesoBrutoKg)

  if (!Number.isFinite(bruto) || !(bruto > 0)) {
    throw new ErroDeNegocio('O peso bruto deve ser maior que zero', 400)
  }

  if (estaVazio(taraKg)) {
    throw new ErroDeNegocio('Informe a tara', 400, 'É o peso do caminhão vazio, medido na segunda pesagem.')
  }
  const tara = lerNumero(taraKg)
  if (!Number.isFinite(tara)) throw new ErroDeNegocio('A tara precisa ser um número', 400, DICA_FORMATO)
  if (!(tara > 0)) {
    throw new ErroDeNegocio('A tara deve ser maior que zero', 400, 'Um caminhão vazio pesa alguma coisa.')
  }
  if (tara < FAIXAS.taraKg.min) {
    throw new ErroDeNegocio(
      `A tara deve ser de pelo menos ${FAIXAS.taraKg.min.toLocaleString('pt-BR')} kg`,
      400,
      'É o peso do caminhão vazio. Confira se não faltou algum dígito.'
    )
  }
  if (tara >= bruto) throw new ErroDeNegocio('A tara não pode ser maior ou igual ao peso bruto', 400)

  return Number((bruto - tara).toFixed(2))
}

function validarMetragem(metragemM3, tipoMateriaPrima) {
  if (estaVazio(metragemM3)) return null

  if (tipoMateriaPrima !== 'LENHA') {
    throw new ErroDeNegocio(
      'A metragem só existe para lenha',
      400,
      'Erva-mate e palito são conferidos por peso; o metro cúbico é a medida do pátio de lenha.'
    )
  }

  const m = lerNumero(metragemM3)
  if (!Number.isFinite(m)) throw new ErroDeNegocio('A metragem precisa ser um número', 400, DICA_FORMATO)
  if (!(m > 0)) throw new ErroDeNegocio('A metragem deve ser maior que zero', 400)
  if (m > 500) {
    throw new ErroDeNegocio(
      'Metragem acima do plausível para uma carga',
      400,
      'Um caminhão de lenha não passa de algumas dezenas de metros cúbicos. Confira se não sobrou um dígito.'
    )
  }
  return Number(m.toFixed(2))
}

function validarPrecoBase(precoBaseKg, { obrigatorio = false } = {}) {
  if (estaVazio(precoBaseKg)) {
    if (obrigatorio) throw new ErroDeNegocio('Informe o preço por quilograma', 400)
    return null
  }
  const preco = lerNumero(precoBaseKg)
  if (!Number.isFinite(preco)) {
    throw new ErroDeNegocio('O preço por quilograma precisa ser um número', 400, DICA_FORMATO)
  }
  if (!(preco > 0)) {
    throw new ErroDeNegocio('O preço por quilograma deve ser maior que zero', 400)
  }
  if (preco > FAIXAS.precoKg.max) {
    throw new ErroDeNegocio(
      `O preço por quilograma deve ser de no máximo R$ ${FAIXAS.precoKg.max},00`,
      400,
      'Confira se não sobrou algum dígito ou se a vírgula está no lugar certo.'
    )
  }
  return Number(preco.toFixed(4))   // o banco guarda quatro casas
}

function calcularPagamento({ pesoLiquidoKg, precoBaseKg = null }) {
  const peso = Number(pesoLiquidoKg)
  if (!(peso > 0)) throw new ErroDeNegocio('O peso líquido deve ser maior que zero', 400)

  const temPreco = precoBaseKg !== null && precoBaseKg !== undefined && precoBaseKg !== ''
  const precoBase = temPreco ? Number(precoBaseKg) : null
  if (temPreco && !(precoBase > 0)) {
    throw new ErroDeNegocio('O preço por quilograma deve ser maior que zero', 400)
  }

  const valorTotal = precoBase === null
    ? null
    : valorDaCarga(peso, precoBase)

  return {
    pesoLiquidoKg: peso,
    precoBaseKg: precoBase,
    valorTotal,
  }
}

function montarFiltro({ produtorId, de, ate, situacao, busca }) {
  const where = {}
  if (produtorId) where.produtorId = String(produtorId)
  if (situacao) where.situacao = daLista(situacao, 'situacaoCarga', 'a situação')

  const termo = String(busca ?? '').trim().slice(0, 100)
  if (termo) {
    where.OR = [
      { numeroTicket: { contains: termo.toUpperCase() } },
      { produtor: { nome: { contains: termo, mode: 'insensitive' } } },
    ]
  }

  if (de || ate) {
    where.dataHora = {}
    if (de) where.dataHora.gte = lerData(de, 'a data inicial')
    if (ate) where.dataHora.lte = lerData(ate, 'a data final')
  }

  return where
}

async function listar({ produtorId, de, ate, situacao, busca, pagina = 1, porPagina = 20 }) {
  const where = montarFiltro({ produtorId, de, ate, situacao, busca })

  const [total, cargas] = await prisma.$transaction([
    prisma.carga.count({ where }),
    prisma.carga.findMany({
      where,
      orderBy: { dataHora: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        produtor: { select: { id: true, nome: true, cpfCnpj: true } },
        motorista: { select: { nome: true } },
        veiculo: { select: { placa: true } },
        analise: true,
      },
    }),
  ])

  return { total, pagina, porPagina, cargas }
}

async function registrarEntrada(dados, usuarioId) {
  const {
    produtorId, ervalId, motoristaId, veiculoId, avaliacaoId,
    tipoMateriaPrima, pesoBrutoKg, precoBaseKg, metragemM3,
    pesoEstimadoCampoKg, observacoes,
  } = dados

  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)
  if (!tipoMateriaPrima) throw new ErroDeNegocio('Informe o tipo de matéria-prima', 400)
  daLista(tipoMateriaPrima, 'tipoMateriaPrima', 'o tipo de matéria-prima')

  const bruto = validarPesoBruto(pesoBrutoKg)

  const erroTexto = erroNosTextos({ observacoes })
  if (erroTexto) throw new ErroDeNegocio(erroTexto, 400)

  const metragem = validarMetragem(metragemM3, tipoMateriaPrima)
  const precoValidado = validarPrecoBase(precoBaseKg)

  let estimadoCampo = null
  if (!estaVazio(pesoEstimadoCampoKg)) {
    estimadoCampo = lerNumero(pesoEstimadoCampoKg)
    if (!Number.isFinite(estimadoCampo) || estimadoCampo <= 0) {
      throw new ErroDeNegocio('O peso estimado em campo deve ser maior que zero', 400)
    }
    numeroNaFaixa(estimadoCampo, { rotulo: 'o peso estimado em campo', ...FAIXAS.pesoEstimadoKg, unidade: ' kg' })
  }
  const daCarga = {
    produtorId, ervalId, motoristaId, veiculoId, avaliacaoId,
    usuarioId,                       // quem estava na balança
    tipoMateriaPrima,
    pesoBrutoKg: bruto,
    taraKg: null,
    pesoLiquidoKg: null,
    metragemM3: metragem,
    pesoEstimadoCampoKg: estimadoCampo,
    precoBaseKg: precoValidado,
    observacoes: estaVazio(observacoes) ? null : String(observacoes).trim(),
    situacao: 'AGUARDANDO_TARA',
  }

  return criarComNumeroSequencial({
    modelo: prisma.carga,
    campo: 'numeroTicket',
    proximoNumero: gerarNumeroTicket,
    dados: daCarga,
    include: {
      produtor: { select: { nome: true, cpfCnpj: true } },
      motorista: { select: { nome: true } },
      veiculo: { select: { placa: true } },
    },
  })
}

async function fecharPesagem(cargaId, dados, usuarioId) {
  const carga = await prisma.carga.findUnique({ where: { id: cargaId } })
  if (!carga) throw new ErroDeNegocio('Carga não encontrada', 404)

  if (carga.situacao !== 'AGUARDANDO_TARA') {
    throw new ErroDeNegocio(
      'Esta carga já teve a pesagem fechada',
      409,
      `O ticket ${carga.numeroTicket} está em "${carga.situacao}". A tara só pode ser informada enquanto a carga aguarda a segunda pesagem.`
    )
  }

  const pesoLiquidoKg = calcularPesoLiquido(carga.pesoBrutoKg, dados.taraKg)

  return prisma.carga.update({
    where: { id: cargaId },
    data: {
      taraKg: lerNumero(dados.taraKg),
      pesoLiquidoKg,
      situacao: 'AGUARDANDO_ANALISE',
      usuarioId,
    },
    include: {
      produtor: { select: { nome: true, cpfCnpj: true } },
      motorista: { select: { nome: true } },
      veiculo: { select: { placa: true } },
    },
  })
}

const MAXIMO_DE_TENTATIVAS = 3

async function criarComNumeroSequencial({ modelo, campo, proximoNumero, dados, include }) {
  for (let tentativa = 1; tentativa <= MAXIMO_DE_TENTATIVAS; tentativa++) {
    try {
      return await modelo.create({
        data: { ...dados, [campo]: await proximoNumero() },
        include,
      })
    } catch (erro) {
      const colidiuNoNumero =
        erro.code === 'P2002' &&
        (erro.meta?.target ?? []).some((alvo) => String(alvo).includes(campo))

      if (!colidiuNoNumero || tentativa === MAXIMO_DE_TENTATIVAS) throw erro
    }
  }
}

async function gerarNumeroTicket() {
  const ano = new Date().getFullYear()
  const prefixo = `PES-${ano}-`
  const ultima = await prisma.carga.findFirst({
    where: { numeroTicket: { startsWith: prefixo } },
    orderBy: { numeroTicket: 'desc' },
    select: { numeroTicket: true },
  })
  const proximo = ultima ? Number(ultima.numeroTicket.slice(prefixo.length)) + 1 : 1
  return prefixo + String(proximo).padStart(5, '0')
}

async function buscarPorId(id) {
  const carga = await prisma.carga.findUnique({
    where: { id },
    include: { produtor: true, erval: true, motorista: true, veiculo: true, analise: true, avaliacao: true },
  })
  if (!carga) throw new ErroDeNegocio('Carga não encontrada', 404)
  return carga
}

module.exports = {
  criarComNumeroSequencial,
  montarFiltro,
  calcularPesoLiquido,
  validarPesoBruto,
  validarPrecoBase,
  calcularPagamento,
  listar,
  registrarEntrada,
  fecharPesagem,
  validarMetragem,
  buscarPorId,
}
