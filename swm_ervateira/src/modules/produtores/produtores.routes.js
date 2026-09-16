const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir, podeNegocio } = require('../../middlewares/autorizacao')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { apenasDigitos, erroNoDocumento } = require('../../lib/documentos')
const { erroDeTamanho } = require('../../lib/textos')

const router = Router()
router.use(autenticar)

const CAMPOS_CADASTRAIS = [
  'nome', 'cpfCnpj', 'telefone', 'cep', 'endereco', 'bairro', 'municipio', 'uf',
  'formaPagamento', 'tipoChavePix', 'chavePix', 'titularConta',
  'banco', 'agencia', 'conta', 'tipoConta',
]
const OBRIGATORIOS = new Set(['nome', 'cpfCnpj', 'formaPagamento'])

function extrairCampos(corpo = {}) {
  const dados = {}
  for (const campo of CAMPOS_CADASTRAIS) {
    const valor = corpo[campo]
    if (valor === undefined) continue
    if (OBRIGATORIOS.has(campo)) {
      if (valor) dados[campo] = String(valor).trim()
    } else {
      dados[campo] = valor === '' || valor === null ? null : valor
    }
  }

  if (dados.cpfCnpj) dados.cpfCnpj = apenasDigitos(dados.cpfCnpj)
  if (dados.cep) dados.cep = apenasDigitos(dados.cep).slice(0, 8) || null
  if (dados.uf) dados.uf = String(dados.uf).toUpperCase().slice(0, 2)

  return dados
}

function ajustarPagamento(dados) {
  const forma = dados.formaPagamento
  if (!forma) return dados

  if (forma === 'PIX') {
    if (!dados.chavePix) {
      throw new ErroDeNegocio('Informe a chave Pix para quem recebe por Pix', 400)
    }
    if (!dados.tipoChavePix) {
      throw new ErroDeNegocio('Informe o tipo da chave Pix', 400)
    }
    Object.assign(dados, { banco: null, agencia: null, conta: null, tipoConta: null })
  }

  if (forma === 'CONTA_BANCARIA') {
    for (const [campo, rotulo] of [['banco', 'o banco'], ['agencia', 'a agência'], ['conta', 'a conta']]) {
      if (!dados[campo]) throw new ErroDeNegocio(`Informe ${rotulo}`, 400)
    }
    if (!dados.tipoConta) {
      throw new ErroDeNegocio('Informe se a conta é corrente ou poupança', 400)
    }
    Object.assign(dados, { tipoChavePix: null, chavePix: null })
  }

  if (forma === 'DINHEIRO') {
    Object.assign(dados, {
      tipoChavePix: null, chavePix: null,
      banco: null, agencia: null, conta: null, tipoConta: null,
    })
  }

  return dados
}

router.get('/', async (req, res) => {
  const { busca } = req.query

  const where = busca
    ? { OR: [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cpfCnpj: { contains: busca } },
      ] }
    : {}

  const produtores = await prisma.produtor.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: {
      ervais: { select: { id: true, identificacao: true, tipoErva: true } },
      _count: { select: { cargas: true } },
    },
  })

  res.json({ total: produtores.length, produtores })
})

router.get('/:id', async (req, res) => {
  const podeVerDinheiro = podeNegocio(req.usuario.perfil, 'ADMINISTRATIVO')

  const produtor = await prisma.produtor.findUnique({
    where: { id: req.params.id },
    include: {
      ervais: true,
      ordensPagamento: podeVerDinheiro
        ? { orderBy: { emitidaEm: 'desc' }, take: 5 }
        : false,
    },
  })
  if (!produtor) return res.status(404).json({ erro: 'Produtor não encontrado' })

  res.json(produtor)
})

router.post('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const dados = extrairCampos(req.body)
  if (!dados.nome) throw new ErroDeNegocio('Informe o nome do produtor', 400)

  const erroLongo = erroDeTamanho(dados)
  if (erroLongo) throw new ErroDeNegocio(erroLongo, 400)

  const erroDoc = erroNoDocumento(dados.cpfCnpj)
  if (erroDoc) throw new ErroDeNegocio(erroDoc, 400)

  const jaExiste = await prisma.produtor.findUnique({
    where: { cpfCnpj: dados.cpfCnpj },
    select: { nome: true },
  })
  if (jaExiste) {
    throw new ErroDeNegocio(
      `Este CPF/CNPJ já está cadastrado para ${jaExiste.nome}. Procure o produtor na lista para editar o cadastro.`,
      409,
    )
  }

  ajustarPagamento(dados)

  const criado = await prisma.produtor.create({ data: dados })
  res.status(201).json(criado)
})

router.put('/:id', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const dados = extrairCampos(req.body)
  if (Object.keys(dados).length === 0) throw new ErroDeNegocio('Nada a atualizar', 400)

  const erroLongo = erroDeTamanho(dados)
  if (erroLongo) throw new ErroDeNegocio(erroLongo, 400)

  if (dados.cpfCnpj) {
    const erroDoc = erroNoDocumento(dados.cpfCnpj)
    if (erroDoc) throw new ErroDeNegocio(erroDoc, 400)

    const deOutro = await prisma.produtor.findUnique({
      where: { cpfCnpj: dados.cpfCnpj },
      select: { id: true, nome: true },
    })
    if (deOutro && deOutro.id !== req.params.id) {
      throw new ErroDeNegocio(
        `Este CPF/CNPJ já está cadastrado para ${deOutro.nome}.`,
        409,
      )
    }
  }
  ajustarPagamento(dados)

  const atualizado = await prisma.produtor.update({
    where: { id: req.params.id },
    data: dados,
  })
  res.json(atualizado)
})

module.exports = router
