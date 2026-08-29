// ---------------------------------------------------------------------------
// MÓDULO · avaliações de campo  (RF05 e RF18)
// ---------------------------------------------------------------------------
// Consulta do que o aplicativo produziu no erval.
//
// Este módulo só LÊ. Não há POST aqui, e a ausência é proposital: a única
// porta de entrada de uma avaliação é POST /api/sincronizacao. Se existisse
// uma segunda, ela entraria sem clientId, sem alteradoEmOrigem e sem linha de
// auditoria — e a garantia de não duplicar valeria metade do tempo.
//
// A tela de campo, na web, é o outro lado do trabalho: o escritório vendo o
// que foi coletado no mato, com foto e coordenada. Sem ela, a única forma de
// conferir uma sincronização seria abrir o banco.

const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')

const router = Router()
router.use(autenticar)

// Consultar é do perfil que vai a campo (e do administrativo, que permitir()
// acrescenta sozinho). O operador de balança não precisa desta tela: a
// estimativa de campo que interessa a ele já vem embutida na carga, em
// GET /api/cargas/:id, e o analista vê a avaliação dentro da própria amostra.

// O produtor NÃO é relação direta da avaliação: o caminho é
// avaliacao → erval → produtor. E está certo assim — quem avalia está numa
// ÁREA, e é a área que pertence a alguém. Uma avaliação ligada direto ao
// produtor permitiria uma avaliação sem área, que no domínio não existe.
const RELACIONADOS = {
  erval: {
    select: {
      id: true, identificacao: true, tipoErva: true, idadeAnos: true,
      produtor: { select: { id: true, nome: true, cpfCnpj: true, municipio: true, uf: true } },
    },
  },
  usuario: { select: { id: true, nome: true } },
  fotos: { select: { id: true, clientId: true, caminho: true, largura: true, altura: true, sincronizadoEm: true } },
  _count: { select: { cargas: true } },
}

/**
 * Junta a situação de sincronização de cada avaliação.
 *
 * Não é um include do Prisma porque RegistroSincronizacao não tem relação
 * declarada com Avaliacao — ele guarda operações de VÁRIAS entidades, ligadas
 * só pelo clientId. Modelar isso como relação obrigaria uma chave estrangeira
 * por entidade, e o registro deixaria de ser o log uniforme que ele é.
 *
 * Uma consulta a mais, com `in`, resolve sem desfazer esse desenho.
 */
async function comSituacao(avaliacoes) {
  if (avaliacoes.length === 0) return []

  const registros = await prisma.registroSincronizacao.findMany({
    where: { clientId: { in: avaliacoes.map((a) => a.clientId) } },
    select: {
      clientId: true, dispositivoId: true, situacao: true,
      tentativas: true, houveConflito: true, versaoVencedora: true,
      criadoEmOrigem: true, recebidoEm: true,
    },
  })

  const porClientId = new Map(registros.map((r) => [r.clientId, r]))
  return avaliacoes.map((a) => ({ ...a, sincronizacao: porClientId.get(a.clientId) || null }))
}

// GET /api/avaliacoes?produtorId=&de=&ate=&dispositivoId=&pagina=&porPagina=
// O que o aplicativo coletou no erval pertence a quem foi a campo.
router.get('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const { produtorId, de, ate, comFoto } = req.query
  const pagina = Number(req.query.pagina) || 1
  const porPagina = Math.min(Number(req.query.porPagina) || 20, 200)

  const where = {}
  if (produtorId) where.erval = { produtorId }
  if (de || ate) {
    where.dataAvaliacao = {}
    if (de) where.dataAvaliacao.gte = new Date(de)
    if (ate) where.dataAvaliacao.lte = new Date(ate)
  }
  // Filtro que a tela usa para responder "quais avaliações têm prova visual?"
  if (comFoto === 'true') where.fotos = { some: {} }

  const [total, avaliacoes, coletadasEmCampo, comFotos] = await prisma.$transaction([
    prisma.avaliacao.count({ where }),
    prisma.avaliacao.findMany({
      where,
      orderBy: { dataAvaliacao: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: RELACIONADOS,
    }),
    prisma.avaliacao.count({ where: { ...where, criadoOffline: true } }),
    prisma.avaliacao.count({ where: { ...where, fotos: { some: {} } } }),
  ])

  res.json({
    total,
    pagina,
    porPagina,
    // Os dois números que a tela mostra no topo. Vêm daqui, e não de uma
    // contagem no navegador, porque a página traz só 20 registros — somar no
    // front daria o total da página, não o do período.
    coletadasEmCampo,
    comFotos,
    avaliacoes: await comSituacao(avaliacoes),
  })
})

// GET /api/avaliacoes/:id
router.get('/:id', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id: req.params.id },
    include: {
      ...RELACIONADOS,
      cargas: {
        select: {
          id: true, numeroTicket: true, dataHora: true,
          pesoLiquidoKg: true, pesoEstimadoCampoKg: true, situacao: true,
        },
      },
    },
  })

  if (!avaliacao) return res.status(404).json({ erro: 'Avaliação não encontrada' })

  const [comIsso] = await comSituacao([avaliacao])
  res.json(comIsso)
})

module.exports = router
