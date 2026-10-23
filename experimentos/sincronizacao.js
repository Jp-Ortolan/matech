// Experimento 1: sincronização com falhas de rede simuladas.
// Imita a fila (Outbox) do aplicativo: cada operação fica na fila até o
// servidor responder ACEITO ou DUPLICADO. A rede falha de dois jeitos:
//  - na ida: a requisição não chega ao servidor;
//  - na volta: o servidor grava, mas a resposta se perde (o caso que gera reenvio).
const { Client } = require('../swm_ervateira/node_modules/pg')
const { gerador, cpf, chamar, entrar } = require('./comum')

const CENARIOS = [
  { nome: 'A', descricao: 'Sem falhas, ordem de criação', falhaIda: 0, falhaVolta: 0, embaralhar: false },
  { nome: 'B', descricao: '30% de falhas (15% ida + 15% volta)', falhaIda: 0.15, falhaVolta: 0.15, embaralhar: false },
  { nome: 'C', descricao: '50% de falhas (25% ida + 25% volta) e ordem embaralhada', falhaIda: 0.25, falhaVolta: 0.25, embaralhar: true },
]
// Nomes realistas: desde 16/10 a API recusa nomes com números ou com palavras de teste.
const NOMES = ['Antônio', 'Maria', 'José', 'Ana', 'Pedro', 'Luciana', 'Valdir', 'Rosane', 'Claudemir', 'Irene']
const SOBRENOMES = ['Kloster', 'Ribeiro dos Santos', 'Wosniak', 'Camargo', 'Lemes', 'Prestes', 'Schmidt', 'Andrade']
const nomeRealista = (i) => NOMES[i % NOMES.length] + ' ' + SOBRENOMES[Math.floor(i / NOMES.length) % SOBRENOMES.length]

const TRIOS = Number(process.env.TRIOS || 100)   // produtor + erval + avaliação
const LOTE = 20
const REPETICOES = Number(process.env.REPETICOES || 3)

function montarOperacoes(rnd, prefixo) {
  const ops = []
  const usados = new Set()
  for (let i = 0; i < TRIOS; i++) {
    let doc
    do { doc = cpf(rnd) } while (usados.has(doc))
    usados.add(doc)
    const p = `${prefixo}-p${i}`, e = `${prefixo}-e${i}`, a = `${prefixo}-a${i}`
    const valor = (3 + rnd() * 2).toFixed(2).replace('.', ',')
    ops.push({ clientId: p, entidade: 'Produtor', criadoEmOrigem: new Date().toISOString(),
      payload: { nome: nomeRealista(i), cpfCnpj: doc, municipio: 'Guarapuava', uf: 'PR', formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: doc } })
    ops.push({ clientId: e, entidade: 'Erval', criadoEmOrigem: new Date().toISOString(),
      payload: { produtorClientId: p, identificacao: `Erval ${i}`, tipoErva: 'NATIVA', quantidadeEstimadaKg: String(1000 + i) } })
    ops.push({ clientId: a, entidade: 'Avaliacao', criadoEmOrigem: new Date().toISOString(),
      payload: { ervalClientId: e, alteradoEmOrigem: new Date(Date.UTC(2026, 9, 1, 12, 0, i)).toISOString(), tipoErva: 'NATIVA',
        quantidadeEstimadaKg: String(1000 + i), valorCombinadoKg: valor, umidadeEstimada: '50' } })
  }
  return ops
}

function embaralhar(lista, rnd) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
  }
}

async function rodar(cenario, repeticao, token, db) {
  const rnd = gerador(1000 * (cenario.nome.charCodeAt(0)) + repeticao)
  const prefixo = `exp-${cenario.nome}${repeticao}-${Date.now()}`
  const ops = montarOperacoes(gerador(Date.now() % 1000003), prefixo)  // CPFs novos a cada execução
  const esperado = new Map(ops.filter((o) => o.entidade === 'Avaliacao').map((o) => [o.clientId, o.payload.valorCombinadoKg]))
  if (cenario.embaralhar) embaralhar(ops, rnd)

  const fila = [...ops]
  const m = { operacoes: ops.length, requisicoes: 0, falhasIda: 0, falhasVolta: 0, duplicadosNoServidor: 0, dependenciaPendente: 0, erros: 0, rodadas: 0 }

  while (fila.length && m.rodadas < 5000) {
    m.rodadas++
    const lote = fila.slice(0, LOTE)
    m.requisicoes++
    if (rnd() < cenario.falhaIda) { m.falhasIda++; continue }
    const r = await chamar('POST', '/api/sincronizacao', token, { dispositivoId: prefixo, operacoes: lote })
    if (r.status !== 200) throw new Error('lote recusado: ' + JSON.stringify(r.json))
    if (rnd() < cenario.falhaVolta) { m.falhasVolta++; continue }   // gravou, mas o app não soube
    const resolvidos = new Set()
    for (const res of r.json.resultados) {
      if (res.situacao === 'ACEITO' || res.situacao === 'DUPLICADO') {
        resolvidos.add(res.clientId)
        // Como o app: os filhos na fila passam a apontar para o id do servidor.
        for (const o of fila) {
          if (o.payload.produtorClientId === res.clientId) o.payload.produtorId = res.id
          if (o.payload.ervalClientId === res.clientId) o.payload.ervalId = res.id
        }
      }
      if (res.situacao === 'DUPLICADO') m.duplicadosNoServidor++
      if (res.situacao === 'DEPENDENCIA_PENDENTE') m.dependenciaPendente++
      if (res.situacao === 'ERRO') { m.erros++; resolvidos.add(res.clientId); console.error(res) }
    }
    // Itens resolvidos saem da fila; pendentes vão para o fim, como no app.
    const restantes = fila.filter((o) => !resolvidos.has(o.clientId))
    const pendentesDoLote = restantes.filter((o) => lote.includes(o))
    fila.length = 0
    fila.push(...restantes.filter((o) => !lote.includes(o)), ...pendentesDoLote)
  }

  const like = prefixo + '-%'
  const q = async (sql) => Number((await db.query(sql, [like])).rows[0].n)
  const produtores = await q('select count(*) n from produtores where "clientId" like $1')
  const ervais = await q('select count(*) n from ervais where "clientId" like $1')
  const avaliacoes = await q('select count(*) n from avaliacoes where "clientId" like $1')
  const valores = (await db.query('select "clientId", "valorCombinadoKg"::text v from avaliacoes where "clientId" like $1', [like])).rows
  let divergentes = 0
  for (const v of valores) if (Number(v.v) !== Number(esperado.get(v.clientId).replace(',', '.'))) divergentes++

  return { cenario: cenario.nome, repeticao, ...m, esperadosPorTipo: TRIOS, produtores, ervais, avaliacoes,
    perdidos: 3 * TRIOS - (produtores + ervais + avaliacoes), valoresDivergentes: divergentes, filaFinal: fila.length }
}

async function conflitos(token, db) {
  // Experimento 1b: dois aparelhos alteram a mesma avaliação; o servidor
  // deve guardar a alteração mais recente, qualquer que seja a ordem de chegada.
  const rnd = gerador(77)
  const pref = `conf-${Date.now()}`
  const p = `${pref}-p`, e = `${pref}-e`
  const doc = cpf(rnd)
  await chamar('POST', '/api/sincronizacao', token, { dispositivoId: pref, operacoes: [
    { clientId: p, entidade: 'Produtor', payload: { nome: 'Rosane Wosniak', cpfCnpj: doc, municipio: 'Guarapuava', uf: 'PR', formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: doc } },
    { clientId: e, entidade: 'Erval', payload: { produtorClientId: p, identificacao: 'Erval conflito', tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000' } },
  ] })
  const casos = 20
  let corretos = 0
  const linhas = []
  for (let i = 0; i < casos; i++) {
    const a = `${pref}-a${i}`
    const t1 = new Date(Date.UTC(2026, 9, 2, 10, 0, i)).toISOString()
    const t2 = new Date(Date.UTC(2026, 9, 2, 10, 5, i)).toISOString()  // mais recente
    const antiga = { clientId: a, entidade: 'Avaliacao', payload: { ervalClientId: e, alteradoEmOrigem: t1, tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000', umidadeEstimada: '50', valorCombinadoKg: '3,10' } }
    const nova = { clientId: a, entidade: 'Avaliacao', payload: { ervalClientId: e, alteradoEmOrigem: t2, tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000', umidadeEstimada: '50', valorCombinadoKg: '4,20' } }
    const ordem = i % 2 === 0 ? [antiga, nova] : [nova, antiga]   // metade chega fora de ordem
    for (const op of ordem) await chamar('POST', '/api/sincronizacao', token, { dispositivoId: `${pref}-${op === nova ? 'B' : 'A'}`, operacoes: [op] })
    const v = (await db.query('select "valorCombinadoKg"::text v from avaliacoes where "clientId"=$1', [a])).rows[0].v
    const ok = Number(v) === 4.2
    if (ok) corretos++
    linhas.push({ caso: i, ordem: i % 2 === 0 ? 'antiga→nova' : 'nova→antiga', valorFinal: v, ok })
  }
  return { casos, corretos, foraDeOrdem: casos / 2 }
}

;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const token = await entrar('marcos.ferrari')
  const resultados = []
  for (const c of (process.env.SO_CONFLITOS ? [] : CENARIOS)) {
    for (let r = 1; r <= REPETICOES; r++) {
      const res = await rodar(c, r, token, db)
      console.log(JSON.stringify(res))
      resultados.push(res)
    }
  }
  const conf = await conflitos(token, db)
  console.log(JSON.stringify({ conflitos: conf }))
  require('node:fs').writeFileSync(__dirname + '/resultado_sincronizacao.json', JSON.stringify({ cenarios: CENARIOS, resultados, conflitos: conf }, null, 2))
  await db.end()
})().catch((e) => { console.error(e); process.exit(1) })
