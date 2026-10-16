const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio, traduzirErro } = require('../../middlewares/erros')
const { lerNumero, estaVazio, DICA_FORMATO } = require('../../lib/numeros')
const { erroNosTextos } = require('../../lib/textos')
const { FAIXAS, numeroNaFaixa, daLista, lerData, coordenada } = require('../../lib/validacao')
const { UFS } = require('../../lib/ufs')
const { apenasDigitos } = require('../../lib/documentos')

// Mesmas regras de texto, lista, UF e telefone da web.
function conferirProdutor(p) {
  const erroTexto = erroNosTextos(p)
  if (erroTexto) throw new ErroDeNegocio(erroTexto, 400)
  daLista(p.formaPagamento, 'formaPagamento', 'a forma de pagamento')
  daLista(p.tipoChavePix, 'tipoChavePix', 'o tipo da chave Pix')
  daLista(p.tipoConta, 'tipoConta', 'o tipo de conta')
  if (p.uf && !UFS.includes(String(p.uf).toUpperCase().trim())) {
    throw new ErroDeNegocio('UF inválida: use a sigla do estado, como PR', 400)
  }
  if (p.telefone) {
    const digitos = apenasDigitos(p.telefone)
    if (digitos.length < 10 || digitos.length > 11) {
      throw new ErroDeNegocio('Telefone inválido: informe DDD e número', 400)
    }
  }
}
const { erroNoDocumento } = require('../../lib/documentos')
const { ajustarPagamento } = require('../../lib/pagamento')

const ENTIDADES = ['Produtor', 'ProdutorAlteracao', 'Erval', 'Avaliacao']

async function receberLote({ dispositivoId, operacoes }, usuarioId) {
  if (!dispositivoId) throw new ErroDeNegocio('Informe o identificador do dispositivo', 400)
  if (typeof dispositivoId !== 'string' || dispositivoId.length > 64) {
    throw new ErroDeNegocio('Identificador do dispositivo inválido', 400)
  }
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
  const { clientId, entidade, payload } = operacao ?? {}
  const criadoEmOrigem = dataValidaOuNula(operacao?.criadoEmOrigem)

  if (!clientId || typeof clientId !== 'string' || clientId.length > 64) return { clientId: null, entidade, situacao: 'ERRO', erro: 'Operação sem clientId' }
  if (!ENTIDADES.includes(entidade)) {
    await registrar({ clientId, entidade, dispositivoId, usuarioId, criadoEmOrigem, payload, situacao: 'ERRO', erro: `Entidade desconhecida: ${entidade}` })
    return { clientId, entidade, situacao: 'ERRO', erro: `Entidade desconhecida: ${entidade}` }
  }

  try {
    const aplicado = await APLICADORES[entidade](clientId, payload || {}, usuarioId)

    if (aplicado.situacao === 'DEPENDENCIA_PENDENTE') {
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

const APLICADORES = {
  async Produtor(clientId, p) {
    if (!p.nome) throw new ErroDeNegocio('Informe o nome do produtor', 400)
    if (!p.cpfCnpj) throw new ErroDeNegocio('Informe o CPF ou CNPJ', 400)

    conferirProdutor(p)

    const erroDoc = erroNoDocumento(p.cpfCnpj)
    if (erroDoc) throw new ErroDeNegocio(erroDoc, 400)

    const mesmoEnvio = await prisma.produtor.findUnique({ where: { clientId } })
    if (mesmoEnvio) return { situacao: 'DUPLICADO', id: mesmoEnvio.id }

    const documento = String(p.cpfCnpj).replace(/\D/g, '')
    if (documento) {
      const mesmaPessoa = await prisma.produtor.findUnique({
        where: { cpfCnpj: documento },
      })
      if (mesmaPessoa) return { situacao: 'DUPLICADO', id: mesmaPessoa.id }
    }

    const dados = {
      clientId,
      nome: String(p.nome).trim(),
      cpfCnpj: documento,
      telefone: vazioVirauNulo(p.telefone),
      endereco: vazioVirauNulo(p.endereco),
      municipio: vazioVirauNulo(p.municipio),
      uf: p.uf ? String(p.uf).toUpperCase().slice(0, 2) : null,
      formaPagamento: p.formaPagamento || 'PIX',
      tipoChavePix: vazioVirauNulo(p.tipoChavePix),
      chavePix: vazioVirauNulo(p.chavePix),
      titularConta: vazioVirauNulo(p.titularConta),
      banco: vazioVirauNulo(p.banco),
      agencia: vazioVirauNulo(p.agencia),
      conta: vazioVirauNulo(p.conta),
      tipoConta: vazioVirauNulo(p.tipoConta),
      criadoOffline: true,
      sincronizadoEm: new Date(),
    }

    // Mesmas regras de pagamento da web.
    ajustarPagamento(dados)

    const criado = await prisma.produtor.create({ data: dados })
    return { situacao: 'ACEITO', id: criado.id }
  },

  // Edição feita no app. Vale a mais recente pelo relógio de quem editou,
  // igual à avaliação. O CPF/CNPJ não muda: é ele que evita duplicidade.
  async ProdutorAlteracao(clientId, p) {
    const jaAplicada = await prisma.registroSincronizacao.findUnique({ where: { clientId } })
    if (jaAplicada?.situacao === 'ENVIADO') return { situacao: 'DUPLICADO', id: p.produtorId ?? null }

    const alteradoEmOrigem = new Date(p.alteradoEmOrigem)
    if (!p.alteradoEmOrigem || isNaN(alteradoEmOrigem)) {
      throw new ErroDeNegocio('A alteração precisa de alteradoEmOrigem', 400)
    }

    const produtorId = await resolverProdutor(p)
    if (!produtorId) {
      return { situacao: 'DEPENDENCIA_PENDENTE', erro: `Produtor ${p.produtorClientId || p.produtorId} ainda não chegou ao servidor` }
    }

    if (!p.nome || String(p.nome).trim().length < 3) throw new ErroDeNegocio('Informe o nome do produtor', 400)
    conferirProdutor(p)

    const atual = await prisma.produtor.findUnique({ where: { id: produtorId } })
    if (atual.atualizadoEm > alteradoEmOrigem) {
      return { situacao: 'ACEITO', id: produtorId, houveConflito: true, versaoVencedora: 'servidor' }
    }

    const dados = ajustarPagamento({
      nome: String(p.nome).trim(),
      telefone: vazioVirauNulo(p.telefone),
      endereco: vazioVirauNulo(p.endereco),
      municipio: vazioVirauNulo(p.municipio),
      uf: p.uf ? String(p.uf).toUpperCase().slice(0, 2) : null,
      formaPagamento: p.formaPagamento || 'PIX',
      tipoChavePix: vazioVirauNulo(p.tipoChavePix),
      chavePix: vazioVirauNulo(p.chavePix),
      titularConta: vazioVirauNulo(p.titularConta),
      banco: vazioVirauNulo(p.banco),
      agencia: vazioVirauNulo(p.agencia),
      conta: vazioVirauNulo(p.conta),
      tipoConta: vazioVirauNulo(p.tipoConta),
      sincronizadoEm: new Date(),
    })

    await prisma.produtor.update({ where: { id: produtorId }, data: dados })
    return { situacao: 'ACEITO', id: produtorId }
  },

  async Erval(clientId, p) {
    const existente = await prisma.erval.findUnique({ where: { clientId } })
    if (existente) return { situacao: 'DUPLICADO', id: existente.id }

    const produtorId = await resolverProdutor(p)
    if (!produtorId) {
      return { situacao: 'DEPENDENCIA_PENDENTE', erro: `Produtor ${p.produtorClientId || p.produtorId} ainda não chegou ao servidor` }
    }
    if (!p.identificacao) throw new ErroDeNegocio('Informe a identificação do erval', 400)
    const erroTexto = erroNosTextos({ identificacao: p.identificacao })
    if (erroTexto) throw new ErroDeNegocio(erroTexto, 400)

    const criado = await prisma.erval.create({
      data: {
        clientId,
        produtorId,
        identificacao: String(p.identificacao).trim(),
        tipoErva: daLista(p.tipoErva, 'tipoErva', 'o tipo de erva', 'NATIVA'),
        quantidadeEstimadaKg: quantidadeEstimada(p.quantidadeEstimadaKg),
        idadeAnos: idade(p.idadeAnos),
        latitude: coordenada(p.latitude, 'latitude'),
        longitude: coordenada(p.longitude, 'longitude'),
        criadoOffline: true,
        sincronizadoEm: new Date(),
      },
    })
    return { situacao: 'ACEITO', id: criado.id }
  },

  async Avaliacao(clientId, p, usuarioId) {
    if (!p.alteradoEmOrigem) {
      throw new ErroDeNegocio('A avaliação precisa de alteradoEmOrigem: é o relógio do aparelho que decide o conflito', 400)
    }
    const alteradoEmOrigem = new Date(p.alteradoEmOrigem)
    if (isNaN(alteradoEmOrigem)) throw new ErroDeNegocio('alteradoEmOrigem inválido', 400)

    const erroTexto = erroNosTextos({ observacoes: p.observacoes, taloAparente: p.taloAparente })
    if (erroTexto) throw new ErroDeNegocio(erroTexto, 400)

    const ervalId = await resolverErval(p)
    if (!ervalId) {
      return { situacao: 'DEPENDENCIA_PENDENTE', erro: `Erval ${p.ervalClientId || p.ervalId} ainda não chegou ao servidor` }
    }

    const dados = {
      ervalId,
      usuarioId,                                  // vem do token, nunca do corpo
      dataAvaliacao: lerData(p.dataAvaliacao, 'a data da avaliação', { semFuturo: true }) ?? new Date(),
      tipoErva: daLista(p.tipoErva, 'tipoErva', 'o tipo de erva', 'NATIVA'),
      ervaQueimada: daLista(p.ervaQueimada, 'ervaQueimada', 'a erva queimada', 'NAO'),
      idadeErvalAnos: idade(p.idadeErvalAnos),
      quantidadeEstimadaKg: quantidadeEstimada(p.quantidadeEstimadaKg),
      classificacao: daLista(p.classificacao, 'classificacao', 'a classificação'),
      umidadeEstimada: numeroNaFaixa(p.umidadeEstimada, { rotulo: 'a umidade estimada', min: 0, max: 100, unidade: '%' }),
      taloAparente: vazioVirauNulo(p.taloAparente),
      valorCombinadoKg: precoCombinado(p.valorCombinadoKg),
      latitude: coordenada(p.latitude, 'latitude'),
      longitude: coordenada(p.longitude, 'longitude'),
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

    if (existente.alteradoEmOrigem.getTime() === alteradoEmOrigem.getTime()) {
      return { situacao: 'DUPLICADO', id: existente.id }
    }
    if (existente.alteradoEmOrigem > alteradoEmOrigem) {
      return { situacao: 'ACEITO', id: existente.id, houveConflito: true, versaoVencedora: 'servidor' }
    }

    const atualizada = await prisma.avaliacao.update({ where: { clientId }, data: dados })
    return { situacao: 'ACEITO', id: atualizada.id, houveConflito: true, versaoVencedora: 'dispositivo' }
  },
}

async function registrarFoto({ clientId, avaliacaoClientId, caminho, dados, tipoMime, tamanhoBytes, largura, altura }, dispositivoId, usuarioId) {
  if (!clientId) throw new ErroDeNegocio('Informe o clientId da foto', 400)

  const jaExiste = await prisma.fotoErval.findUnique({ where: { clientId }, select: { id: true, caminho: true } })
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
      dados,
      tipoMime,
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

  await prisma.registroSincronizacao.upsert({
    where: { clientId },
    create: { clientId, tentativas: 1, ...base },
    update: { ...base, tentativas: { increment: 1 } },
  })
}

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
  const conhecido = traduzirErro(e)
  if (conhecido) return conhecido.detalhe ? `${conhecido.erro}: ${conhecido.detalhe}` : conhecido.erro
  console.error('[sincronizacao] erro não tratado', e)
  return 'Erro ao gravar no servidor'
}

// Faixas dos números que vêm do app (as mesmas da tela do app).
function quantidadeEstimada(v) {
  const n = numeroDoAparelho(v, 'A quantidade estimada')
  if (n === null) return null
  return numeroNaFaixa(n, { rotulo: 'a quantidade estimada', min: 0.01, ...FAIXAS.pesoEstimadoKg, unidade: ' kg' })
}
function idade(v) {
  if (estaVazio(v)) return null
  return numeroNaFaixa(v, { rotulo: 'a idade do erval', ...FAIXAS.idadeAnos, inteiro: true, unidade: ' anos' })
}
function precoCombinado(v) {
  const n = numeroDoAparelho(v, 'O valor combinado')
  if (n === null) return null
  return numeroNaFaixa(n, { rotulo: 'o valor combinado', min: 0.01, ...FAIXAS.precoKg })
}
function dataValidaOuNula(v) {
  const d = v ? new Date(v) : null
  return d && !isNaN(d) ? d : null
}

const vazioVirauNulo = (v) => (v === undefined || v === null || v === '' ? null : v)
// Valor digitado no app: vazio vira nulo; formato errado é recusado
// (antes virava nulo calado e o dado se perdia).
function numeroDoAparelho(valor, rotulo) {
  if (estaVazio(valor)) return null
  const n = lerNumero(valor)
  if (!Number.isFinite(n)) throw new ErroDeNegocio(`${rotulo} precisa ser um número`, 400, DICA_FORMATO)
  return n
}
const inteiroOuNulo = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : parseInt(v, 10))

module.exports = { receberLote, registrarFoto, resumo, listarRegistros }
