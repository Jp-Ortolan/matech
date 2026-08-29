// ---------------------------------------------------------------------------
// MÓDULO · produtores  (RF01 e RF02)
// ---------------------------------------------------------------------------
// Este módulo é pequeno, então rota, controlador e consulta cabem no mesmo
// arquivo. Quando crescer — cadastro, edição, verificação de duplicidade —
// vale separar em produtores.service.js e produtores.controller.js, como
// está feito em cargas.

const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir, podeNegocio } = require('../../middlewares/autorizacao')
const { ocultarDoProdutor } = require('../../lib/sigilo')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { apenasDigitos, erroNoDocumento } = require('../../lib/documentos')

const router = Router()
router.use(autenticar)

// Campos que o cadastro aceita gravar. A lista é explícita de propósito:
// sem ela, um corpo de requisição inesperado poderia sobrescrever clientId,
// criadoOffline ou sincronizadoEm — e são justamente esses campos que
// sustentam a idempotência do envio feito em campo, sem conexão (RF17).
const CAMPOS_CADASTRAIS = [
  'nome', 'cpfCnpj', 'telefone', 'cep', 'endereco', 'bairro', 'municipio', 'uf',
  'formaPagamento', 'tipoChavePix', 'chavePix', 'titularConta',
  'banco', 'agencia', 'conta', 'tipoConta',
]
const OBRIGATORIOS = new Set(['nome', 'cpfCnpj', 'formaPagamento'])

/** Copia do corpo só o que é campo cadastral, tratando o campo vazio como nulo. */
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

  // Documento e CEP são guardados SÓ COM DÍGITOS. A pontuação é enfeite de
  // tela: gravá-la faria "529.982.247-25" e "52998224725" serem dois
  // produtores diferentes para o índice único, que é exatamente o problema
  // que a chave única existe para impedir.
  if (dados.cpfCnpj) dados.cpfCnpj = apenasDigitos(dados.cpfCnpj)
  if (dados.cep) dados.cep = apenasDigitos(dados.cep).slice(0, 8) || null
  if (dados.uf) dados.uf = String(dados.uf).toUpperCase().slice(0, 2)

  return dados
}

/**
 * Coerência entre a forma de pagamento e os campos que a acompanham.
 *
 * Sem isto, um produtor poderia ficar marcado como "recebe por Pix" e sem
 * chave nenhuma — e o erro só apareceria na emissão da ordem, semanas depois,
 * quando alguém fosse pagar. Falhar aqui, no cadastro, custa dez segundos.
 *
 * Os campos das outras formas são LIMPOS junto: um produtor que migrou de
 * conta bancária para Pix não pode continuar carregando agência e conta
 * antigas, que apareceriam na ordem e confundiriam quem paga.
 */
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
    // Em espécie não há destino a guardar. Deixar resíduo de Pix ou de conta
    // faria a ordem de pagamento sugerir uma transferência que não existe.
    Object.assign(dados, {
      tipoChavePix: null, chavePix: null,
      banco: null, agencia: null, conta: null, tipoConta: null,
    })
  }

  return dados
}

// GET /api/produtores?busca=
router.get('/', async (req, res) => {
  const { busca } = req.query

  // "mode: insensitive" faz a busca ignorar maiúsculas e minúsculas.
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

  // A LISTA SAI SEMPRE MASCARADA, para todo perfil.
  //
  // Ninguém precisa do CPF inteiro de trinta produtores numa tabela: quem
  // procura confere pelos últimos dígitos, e quem vai usar o número abre a
  // ficha e pede para ver. Mandar tudo em claro seria expor o cadastro
  // completo a cada carregamento de tela.
  res.json({
    total: produtores.length,
    produtores: produtores.map(ocultarDoProdutor),
  })
})

// GET /api/produtores/:id
//
// A ficha é aberta a todos os perfis — a balança precisa dela para registrar a
// pesagem. O que NÃO é aberto são as ordens de pagamento que vêm junto: elas
// são dinheiro, e seguem a mesma regra de GET /api/pagamentos.
//
// Elas são retiradas AQUI, e não escondidas na tela. Dado que a tela não deve
// mostrar não deve sair do servidor: escondido no front, ele continua viajando
// pela rede e aparece inteiro em qualquer inspetor do navegador.
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

  // A ficha também sai mascarada. Quem precisa do número pede em
  // /sigilosos, abaixo — e aí o pedido fica atribuído a um usuário.
  res.json(ocultarDoProdutor(produtor))
})

// ---------------------------------------------------------------------------
// GET /api/produtores/:id/sigilosos — o dado pessoal em claro
// ---------------------------------------------------------------------------
// Uma rota só, que devolve APENAS o que o perfil de quem pediu pode ver:
//
//   documento  → quem cadastra produtor precisa conferir e corrigir o CPF
//   chave Pix  → quem paga precisa do destino do dinheiro
//
// Perfil que não pode ver nenhum dos dois recebe 403, e não um objeto vazio:
// objeto vazio pareceria "este produtor não tem CPF cadastrado", que é uma
// informação diferente e errada.
router.get('/:id/sigilosos', async (req, res) => {
  const perfil = req.usuario.perfil
  const veDocumento = podeNegocio(perfil, 'COMPRADOR_AVALIADOR')
  const vePagamento = podeNegocio(perfil, 'ADMINISTRATIVO')

  if (!veDocumento && !vePagamento) {
    return res.status(403).json({
      erro: 'Sem permissão',
      detalhe: `O perfil ${perfil} não pode ver dados pessoais de produtor.`,
    })
  }

  const produtor = await prisma.produtor.findUnique({
    where: { id: req.params.id },
    select: { id: true, cpfCnpj: true, chavePix: true, tipoChavePix: true, conta: true, agencia: true },
  })
  if (!produtor) return res.status(404).json({ erro: 'Produtor não encontrado' })

  const resposta = {}
  if (veDocumento) resposta.cpfCnpj = produtor.cpfCnpj
  if (vePagamento) {
    resposta.chavePix = produtor.chavePix
    resposta.conta = produtor.conta
  }
  res.json(resposta)
})

// POST /api/produtores — cadastro (o avaliador cadastra em campo)
router.post('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const dados = extrairCampos(req.body)
  if (!dados.nome) throw new ErroDeNegocio('Informe o nome do produtor', 400)

  // A validação do documento acontece AQUI e não só na tela. A tela avisa
  // cedo; o servidor é quem garante — porque o aplicativo móvel também grava
  // produtor, e um dia haverá um terceiro cliente.
  const erroDoc = erroNoDocumento(dados.cpfCnpj)
  if (erroDoc) throw new ErroDeNegocio(erroDoc, 400)

  ajustarPagamento(dados)

  const criado = await prisma.produtor.create({ data: dados })
  res.status(201).json(criado)
})

// PUT /api/produtores/:id — atualização cadastral pela web.
// Mesma permissão do cadastro: quem pode criar pode corrigir. O CPF/CNPJ
// duplicado é barrado pelo próprio banco e devolvido como 409 pelo
// tratador de erros (código P2002 do Prisma).
router.put('/:id', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const dados = extrairCampos(req.body)
  if (Object.keys(dados).length === 0) throw new ErroDeNegocio('Nada a atualizar', 400)

  if (dados.cpfCnpj) {
    const erroDoc = erroNoDocumento(dados.cpfCnpj)
    if (erroDoc) throw new ErroDeNegocio(erroDoc, 400)
  }
  ajustarPagamento(dados)

  const atualizado = await prisma.produtor.update({
    where: { id: req.params.id },
    data: dados,
  })
  res.json(atualizado)
})

module.exports = router
