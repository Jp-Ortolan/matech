// Experimento 4: tempo de resposta das operações principais (RNF03).
// Com SO_LEITURA=1 mede só consultas e login (seguro para o servidor publicado).
// Mede cada operação N vezes, em sequência, e guarda mediana e percentil 95.
const { gerador, cpf, chamar, entrar, percentil } = require('./comum')

const N = Number(process.env.N || 200)

async function medir(nome, fn) {
  const tempos = []
  for (let i = 0; i < 5; i++) await fn(i)              // aquecimento
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint()
    const r = await fn(i)
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    if (r.status >= 400) throw new Error(nome + ' falhou: ' + r.status + ' ' + JSON.stringify(r.json))
    tempos.push(ms)
  }
  return { operacao: nome, n: N, medianaMs: +percentil(tempos, 50).toFixed(1), p95Ms: +percentil(tempos, 95).toFixed(1), maxMs: +Math.max(...tempos).toFixed(1) }
}

;(async () => {
  const rnd = gerador(Date.now() % 1000003)
  const campo = await entrar('marcos.ferrari')
  const balanca = await entrar('rogerio.anselmo')
  const adm = await entrar('solange.petry')
  const produtorId = (await chamar('GET', '/api/produtores', adm)).json
  const pid = (Array.isArray(produtorId) ? produtorId : produtorId.produtores || produtorId.itens)[0].id
  const pref = 'perf-' + Date.now()

  const res = []
  res.push(await medir('Login', () => chamar('POST', '/api/auth/login', null, { usuario: 'solange.petry', senha: process.env.SENHA_SEED || 'Senha123' })))
  res.push(await medir('Listar cargas (página de 20)', () => chamar('GET', '/api/cargas?porPagina=20', adm)))
  if (!process.env.SO_LEITURA) res.push(await medir('Registrar entrada na balança', () => chamar('POST', '/api/cargas', balanca, { produtorId: pid, tipoMateriaPrima: 'ERVA_MATE_NATIVA', pesoBrutoKg: '18.540', precoBaseKg: '1,35' })))
  res.push(await medir('Listar produtores', () => chamar('GET', '/api/produtores', adm)))
  res.push(await medir('Painel de pagamentos em aberto', () => chamar('GET', '/api/pagamentos/aguardando', adm)))
  if (!process.env.SO_LEITURA) res.push(await medir('Sincronizar lote de 20 operações', (i) => {
    const ops = []
    for (let k = 0; k < 7; k++) {
      const p = `${pref}-${i}-${k}`, doc = cpf(rnd)
      ops.push({ clientId: p + 'p', entidade: 'Produtor', payload: { nome: 'Perf', cpfCnpj: doc, formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: doc } })
      ops.push({ clientId: p + 'e', entidade: 'Erval', payload: { produtorClientId: p + 'p', identificacao: 'E', tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000' } })
      if (k < 6) ops.push({ clientId: p + 'a', entidade: 'Avaliacao', payload: { ervalClientId: p + 'e', alteradoEmOrigem: new Date().toISOString(), tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000', umidadeEstimada: '50', valorCombinadoKg: '4,10' } })
    }
    return chamar('POST', '/api/sincronizacao', campo, { dispositivoId: pref, operacoes: ops.slice(0, 20) })
  }))
  console.table(res)
  require('node:fs').writeFileSync(__dirname + '/resultado_desempenho.json', JSON.stringify({ ambiente: process.env.AMBIENTE || 'local', base: require('./comum').BASE, resultados: res }, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })
