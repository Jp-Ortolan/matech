// ---------------------------------------------------------------------------
// SERVIÇO · sincronização  (RF17 e RF18)
// ---------------------------------------------------------------------------
// Este é o serviço que recebe o que o aplicativo coletou no erval, sem conexão.
// É o coração do trabalho: a lacuna que o Mapeamento Sistemático apontou não é
// digitalizar o recebimento, é fazer a coleta em campo voltar para o servidor
// sem duplicar e sem perder nada.
//
// TRÊS GARANTIAS, E COMO CADA UMA É OBTIDA
//
// 1. NÃO DUPLICAR — idempotência por clientId.
//    O aparelho gera um UUID para cada registro ANTES de enviar. Se a resposta
//    do servidor se perder no caminho (e no meio do mato ela se perde), o
//    aplicativo reenvia o mesmo pacote. Como a gravação é um upsert na chave
//    clientId, o reenvio encontra o registro já existente e não cria outro.
//    É por isso que clientId é @unique no schema: a garantia é do banco, não
//    de um "if" nosso que alguém pode esquecer de escrever.
//
// 2. NÃO PERDER — o registro da tentativa é gravado mesmo quando ela falha.
//    Cada operação recebida vira uma linha em RegistroSincronizacao, com
//    situação, número de tentativas e a mensagem do erro. É daqui que sai a
//    taxa de sincronização do Quadro 7: enviados com sucesso ÷ total coletado.
//
// 3. NÃO SE CONTRADIZER — última escrita válida, pelo relógio da ORIGEM.
//    Se a mesma avaliação foi editada no aparelho e no servidor, vence a que
//    mudou por último NO APARELHO (alteradoEmOrigem), e não a que chegou por
//    último. O relógio do servidor não sabe quando o avaliador corrigiu o
//    número no erval; o do aparelho sabe. A escolha perdedora fica registrada
//    em houveConflito e versaoVencedora, para ser auditável depois.
//
// SOBRE A ORDEM: uma avaliação depende de um erval, que depende de um produtor.
// Os três podem ter nascido offline e nenhum tem id de servidor ainda — eles se
// referenciam por clientId. Quando a dependência ainda não chegou, a operação
// NÃO é erro: volta como DEPENDENCIA_PENDENTE e o aplicativo a mantém na fila.
// Tratar isso como falha faria o aplicativo desistir de um dado que está
// perfeitamente bom, só desordenado.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

const ENTIDADES = ['Produtor', 'Erval', 'Avaliacao']

/**
 * Recebe um lote de operações do aparelho e devolve o resultado de cada uma.
 *
 * O lote NÃO é uma transação única de propósito: se a décima operação falhar
 * por um dado inválido, as nove anteriores devem permanecer gravadas. Desfazer
 * tudo obrigaria o avaliador a reenviar um dia inteiro de trabalho por causa de
 * um campo errado. Cada operação é atômica em si; o lote é só o transporte.
 */
async function receberLote({ dispositivoId, operacoes }, usuarioId) {
  if (!dispositivoId) throw new ErroDeNegocio('Informe o identificador do dispositivo', 400)
  if (!Array.isArray(operacoes)) throw new ErroDeNegocio('O lote precisa de uma lista de operações', 400)
  if (operacoes.length === 0) return { recebidas: 0, resultados: [] }
  if (operacoes.length > 200) throw new ErroDeNegocio('Envie no máximo 200 operações por lote', 400)

  const resultados = []
  for (const operacao of operacoes) {
    resultados.push(await aplicarUma(operacao, dispositivoId, usuarioId))
  }

  return {
    recebidas: operacoes.length,
    aceitas: resultados.filter((r) => r.situacao === 'ACEITO').length,
    duplicadas: resultados.filter((r) => r.situacao === 'DUPLICADO').length,
    pendentes: resultados.filter((r) => r.situacao === 'DEPENDENCIA_PENDENTE').length,
    comErro: resultados.filter((r) => r.situacao === 'ERRO').length,
    resultados,
  }
}

async function aplicarUma(operacao, dispositivoId, usuarioId) {
  const { clientId, entidade, criadoEmOrigem, payload } = operacao

  if (!clientId) return { clientId: null, entidade, situacao: 'ERRO', erro: 'Operação sem clientId' }
  if (!ENTIDADES.includes(entidade)) {
    await registrar({ clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload, situacao: 'ERRO', erro: `Entidade desconhecida: ${entidade}` })
    return { clientId, entidade, situacao: 'ERRO', erro: `Entidade desconhecida: ${entidade}` }
  }

  try {
    const aplicado = await APLICADORES[entidade](clientId, payload || {}, usuarioId)

    if (aplicado.situacao === 'DEPENDENCIA_PENDENTE') {
      // Fica registrado como PENDENTE: o aparelho vai reenviar depois que a
      // dependência subir, e a contagem de tentativas conta essa história.
      await registrar({ clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload, situacao: 'PENDENTE', erro: aplicado.erro })
      return { clientId, entidade, ...aplicado }
    }

    await registrar({
      clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload,
      situacao: 'ENVIADO',
      houveConflito: aplicado.houveConflito || false,
      versaoVencedora: aplicado.versaoVencedora || null,
    })
    return { clientId, entidade, ...aplicado }
  } catch (e) {
    const mensagem = e instanceof ErroDeNegocio ? e.message : traduzirErroDoPrisma(e)
    await registrar({ clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload, situacao: 'ERRO', erro: mensagem })
    return { clientId, entidade, situacao: 'ERRO', erro: mensagem }
  }
}

// ---------------------------------------------------------------------------
// APLICADORES · um por entidade
// ---------------------------------------------------------------------------

const APLICADORES = {
  /** Produtor cadastrado em campo. Não depende de nada — é sempre a raiz. */
  async Produtor(clientId, p) {
    if (!p.nome) throw new ErroDeNegocio('Informe o nome do produtor', 400)
    if (!p.cpfCnpj) throw new ErroDeNegocio('Informe o CPF ou CNPJ', 400)

    const existente = await prisma.produtor.findUnique({ where: { clientId } })
    if (existente) return { situacao: 'DUPLICADO', id: existente.id }

    const dados = {
      clientId,
      nome: String(p.nome).trim(),
      cpfCnpj: String(p.cpfCnpj).trim(),
      telefone: vazioVirauNulo(p.telefone),
      endereco: vazioVirauNulo(p.endereco),
      municipio: vazioVirauNulo(p.municipio),
      uf: p.uf ? String(p.uf).toUpperCase().slice(0, 2) : null,
      formaPagamento: p.formaPagamento || 'PIX',
      tipoChavePix: vazioVirauNulo(p.tipoChavePix),
      chavePix: vazioVirauNulo(p.chavePix),
      titularConta: vazioVirauNulo(p.titularConta),
      criadoOffline: true,
      sincronizadoEm: new Date(),
    }

    const criado = await prisma.produtor.create({ data: dados })
    return { situacao: 'ACEITO', id: criado.id }
  },

  /** Área de colheita. Depende do produtor, que pode ter subido no mesmo lote. */
  async Erval(clientId, p) {
    const existente = await prisma.erval.findUnique({ where: { clientId } })
    if (existente) return { situacao: 'DUPLICADO', id: existente.id }

    const produtorId = await resolverProdutor(p)
    if (!produtorId) {
      return { situacao: 'DEPENDENCIA_PENDENTE', erro: `Produtor ${p.produtorClientId || p.produtorId} ainda não chegou ao servidor` }
    }
    if (!p.identificacao) throw new ErroDeNegocio('Informe a identificação do erval', 400)

    const criado = await prisma.erval.create({
      data: {
        clientId,
        produtorId,
        identificacao: String(p.identificacao).trim(),
        tipoErva: p.tipoErva || 'NATIVA',
        quantidadeEstimadaKg: numeroOuNulo(p.quantidadeEstimadaKg),
        idadeAnos: inteiroOuNulo(p.idadeAnos),
        latitude: numeroOuNulo(p.latitude),
        longitude: numeroOuNulo(p.longitude),
        criadoOffline: true,
        sincronizadoEm: new Date(),
      },
    })
    return { situacao: 'ACEITO', id: criado.id }
  },

  /** A avaliação em campo. É a única entidade com resolução de conflito. */
  async Avaliacao(clientId, p, usuarioId) {
    if (!p.alteradoEmOrigem) {
      throw new ErroDeNegocio('A avaliação precisa de alteradoEmOrigem: é o relógio do aparelho que decide o conflito', 400)
    }
    const alteradoEmOrigem = new Date(p.alteradoEmOrigem)
    if (isNaN(alteradoEmOrigem)) throw new ErroDeNegocio('alteradoEmOrigem inválido', 400)

    const ervalId = await resolverErval(p)
    if (!ervalId) {
      return { situacao: 'DEPENDENCIA_PENDENTE', erro: `Erval ${p.ervalClientId || p.ervalId} ainda não chegou ao servidor` }
    }

    const dados = {
      ervalId,
      usuarioId,                                  // vem do token, nunca do corpo
      dataAvaliacao: p.dataAvaliacao ? new Date(p.dataAvaliacao) : new Date(),
      tipoErva: p.tipoErva || 'NATIVA',
      ervaQueimada: p.ervaQueimada || 'NAO',
      idadeErvalAnos: inteiroOuNulo(p.idadeErvalAnos),
      quantidadeEstimadaKg: numeroOuNulo(p.quantidadeEstimadaKg),
      classificacao: vazioVirauNulo(p.classificacao),
      umidadeEstimada: numeroOuNulo(p.umidadeEstimada),
      taloAparente: vazioVirauNulo(p.taloAparente),
      valorCombinadoKg: numeroOuNulo(p.valorCombinadoKg),
      latitude: numeroOuNulo(p.latitude),
      longitude: numeroOuNulo(p.longitude),
      observacoes: vazioVirauNulo(p.observacoes),
      criadoOffline: true,
      alteradoEmOrigem,
      sincronizadoEm: new Date(),
    }

    const existente = await prisma.avaliacao.findUnique({ where: { clientId } })

    if (!existente) {
      const criada = await prisma.avaliacao.create({ data: { clientId, ...dados } })
      return { situacao: 'ACEITO', id: criada.id }
    }

    // Já existe: é reenvio ou é edição? Quem responde é o relógio da origem.
    if (existente.alteradoEmOrigem.getTime() === alteradoEmOrigem.getTime()) {
      return { situacao: 'DUPLICADO', id: existente.id }
    }
    if (existente.alteradoEmOrigem > alteradoEmOrigem) {
      // O que está gravado é mais novo que o que chegou: o envio é de uma
      // versão velha do aparelho. Mantém o servidor e deixa o conflito anotado.
      return { situacao: 'ACEITO', id: existente.id, houveConflito: true, versaoVencedora: 'servidor' }
    }

    const atualizada = await prisma.avaliacao.update({ where: { clientId }, data: dados })
    return { situacao: 'ACEITO', id: atualizada.id, houveConflito: true, versaoVencedora: 'dispositivo' }
  },
}

// ---------------------------------------------------------------------------
// FOTOS · chegam por fora do lote, uma requisição por foto
// ---------------------------------------------------------------------------
// Foto de celular tem de 2 a 4 MB. Mandar junto do lote, em base64, incharia a
// requisição em um terço e faria a avaliação inteira falhar quando a conexão
// cortasse no meio da terceira foto. Por isso cada foto viaja sozinha, depois,
// e o fracasso de uma não arrasta as outras nem a avaliação.

async function registrarFoto({ clientId, avaliacaoClientId, caminho, tamanhoBytes, largura, altura }, dispositivoId, usuarioId) {
  if (!clientId) throw new ErroDeNegocio('Informe o clientId da foto', 400)

  const jaExiste = await prisma.fotoErval.findUnique({ where: { clientId } })
  if (jaExiste) return { situacao: 'DUPLICADO', id: jaExiste.id, caminho: jaExiste.caminho }

  const avaliacao = await prisma.avaliacao.findUnique({ where: { clientId: avaliacaoClientId } })
  if (!avaliacao) {
    return { situacao: 'DEPENDENCIA_PENDENTE', erro: `A avaliação ${avaliacaoClientId} ainda não chegou ao servidor` }
  }

  const criada = await prisma.fotoErval.create({
    data: {
      clientId,
      avaliacaoId: avaliacao.id,
      caminho,
      tamanhoBytes: inteiroOuNulo(tamanhoBytes),
      largura: inteiroOuNulo(largura),
      altura: inteiroOuNulo(altura),
      sincronizadoEm: new Date(),
    },
  })

  await registrar({
    clientId, entidade: 'FotoErval', dispositivoId, usuarioId,
    criadoEmOrigem: new Date(), payload: { avaliacaoClientId, caminho, tamanhoBytes },
    situacao: 'ENVIADO',
  })

  return { situacao: 'ACEITO', id: criada.id, caminho }
}

// ---------------------------------------------------------------------------
// CONSULTA · a taxa de sincronização do Quadro 7
// ---------------------------------------------------------------------------

async function resumo({ dispositivoId }) {
  const where = dispositivoId ? { dispositivoId } : {}

  const [total, enviados, pendentes, comErro, conflitos, porEntidade] = await prisma.$transaction([
    prisma.registroSincronizacao.count({ where }),
    prisma.registroSincronizacao.count({ where: { ...where, situacao: 'ENVIADO' } }),
    prisma.registroSincronizacao.count({ where: { ...where, situacao: 'PENDENTE' } }),
    prisma.registroSincronizacao.count({ where: { ...where, situacao: 'ERRO' } }),
    prisma.registroSincronizacao.count({ where: { ...where, houveConflito: true } }),
    prisma.registroSincronizacao.groupBy({ by: ['entidade', 'situacao'], where, _count: true }),
  ])

  return {
    total,
    enviados,
    pendentes,
    comErro,
    conflitos,
    // O indicador do Quadro 7: enviados com sucesso ÷ total coletado offline.
    taxaSincronizacao: total ? Number(((enviados / total) * 100).toFixed(2)) : null,
    porEntidade: porEntidade.map((g) => ({ entidade: g.entidade, situacao: g.situacao, total: g._count })),
  }
}

async function listarRegistros({ dispositivoId, situacao, limite = 100 }) {
  const where = {}
  if (dispositivoId) where.dispositivoId = dispositivoId
  if (situacao) where.situacao = situacao

  const registros = await prisma.registroSincronizacao.findMany({
    where,
    orderBy: { recebidoEm: 'desc' },
    take: Math.min(Number(limite) || 100, 500),
  })
  return { total: registros.length, registros }
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/** Grava (ou atualiza) a linha de auditoria daquela operação. */
async function registrar({ clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload, situacao, erro, houveConflito, versaoVencedora }) {
  const base = {
    dispositivoId,
    usuarioId,
    entidade,
    operacao: 'CREATE',
    payload: payload ?? undefined,
    situacao,
    erroMensagem: erro || null,
    houveConflito: houveConflito || false,
    versaoVencedora: versaoVencedora || null,
    criadoEmOrigem: criadoEmOrigem ? new Date(criadoEmOrigem) : new Date(),
    confirmadoEm: situacao === 'ENVIADO' ? new Date() : null,
  }

  // upsert com incremento de tentativas: cada reenvio da mesma operação soma
  // uma tentativa, e é isso que mostra quantas vezes a conexão caiu no meio.
  await prisma.registroSincronizacao.upsert({
    where: { clientId },
    create: { clientId, tentativas: 1, ...base },
    update: { ...base, tentativas: { increment: 1 } },
  })
}

/** O produtor pode vir pelo id do servidor ou pelo clientId do aparelho. */
async function resolverProdutor(p) {
  if (p.produtorId) {
    const porId = await prisma.produtor.findUnique({ where: { id: p.produtorId }, select: { id: true } })
    if (porId) return porId.id
  }
  if (p.produtorClientId) {
    const porClient = await prisma.produtor.findUnique({ where: { clientId: p.produtorClientId }, select: { id: true } })
    if (porClient) return porClient.id
  }
  return null
}

async function resolverErval(p) {
  if (p.ervalId) {
    const porId = await prisma.erval.findUnique({ where: { id: p.ervalId }, select: { id: true } })
    if (porId) return porId.id
  }
  if (p.ervalClientId) {
    const porClient = await prisma.erval.findUnique({ where: { clientId: p.ervalClientId }, select: { id: true } })
    if (porClient) return porClient.id
  }
  return null
}

function traduzirErroDoPrisma(e) {
  if (e.code === 'P2002') return `Já existe um registro com este valor em: ${e.meta?.target}`
  if (e.code === 'P2003') return 'Referência para um registro que não existe'
  console.error('[sincronizacao] erro não tratado', e)
  return 'Erro ao gravar no servidor'
}

const vazioVirauNulo = (v) => (v === undefined || v === null || v === '' ? null : v)
const numeroOuNulo = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v))
const inteiroOuNulo = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : parseInt(v, 10))

module.exports = { receberLote, registrarFoto, resumo, listarRegistros }
