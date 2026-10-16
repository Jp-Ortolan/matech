const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir, podeNegocio } = require('../../middlewares/autorizacao')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { apenasDigitos, erroNoDocumento } = require('../../lib/documentos')
const { erroNosTextos } = require('../../lib/textos')
const { daLista } = require('../../lib/validacao')
const { UFS } = require('../../lib/ufs')
const { ajustarPagamento } = require('../../lib/pagamento')

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
  if (dados.uf) dados.uf = String(dados.uf).toUpperCase().trim()

  // Texto: tira espaços das pontas.
  for (const [campo, valor] of Object.entries(dados)) {
    if (typeof valor === 'string') dados[campo] = valor.trim() || null
  }
  return dados
}

// Formato dos campos que têm lista ou padrão fixo.
function conferirFormato(dados) {
  const erroTexto = erroNosTextos(dados)
  if (erroTexto) throw new ErroDeNegocio(erroTexto, 400)

  if (dados.formaPagamento !== undefined) daLista(dados.formaPagamento, 'formaPagamento', 'a forma de pagamento')
  if (dados.tipoChavePix) daLista(dados.tipoChavePix, 'tipoChavePix', 'o tipo da chave Pix')
  if (dados.tipoConta) daLista(dados.tipoConta, 'tipoConta', 'o tipo de conta')
  if (dados.uf && !UFS.includes(dados.uf)) throw new ErroDeNegocio('UF inválida: use a sigla do estado, como PR', 400)
  if (dados.cep && dados.cep.length !== 8) throw new ErroDeNegocio('O CEP tem 8 dígitos', 400)
  if (dados.telefone) {
    const digitos = apenasDigitos(dados.telefone)
    if (digitos.length < 10 || digitos.length > 11) {
      throw new ErroDeNegocio('Telefone inválido: informe DDD e número, como (42) 99999-9999', 400)
    }
  }
}

router.get('/', async (req, res) => {
  const busca = String(req.query.busca ?? '').trim().slice(0, 100)

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
  conferirFormato(dados)

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
  if ('nome' in req.body && !dados.nome) throw new ErroDeNegocio('O nome do produtor não pode ficar vazio', 400)
  conferirFormato(dados)

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
