// Experimento 5: teste de carga simples (RNF04).
// Simula vários usuários ao mesmo tempo fazendo consultas do dia a dia
// e mede tempo de resposta, vazão e erros para cada nível de usuários.
// Uso: API=http://localhost:3333 node carga.js   (DURACAO em segundos, padrão 30)
const { chamar, entrar, percentil } = require('./comum')

const NIVEIS = (process.env.NIVEIS || '1,10,25,50').split(',').map(Number)
const DURACAO = Number(process.env.DURACAO || 30) * 1000

;(async () => {
  const adm = await entrar('solange.petry')
  const lista = (await chamar('GET', '/api/produtores', adm)).json
  const pid = (Array.isArray(lista) ? lista : lista.produtores || lista.itens)[0].id

  // operações de leitura usadas pelo escritório
  const ops = [
    () => chamar('GET', '/api/cargas?pagina=1', adm),
    () => chamar('GET', '/api/pagamentos/aguardando', adm),
    () => chamar('GET', `/api/produtores/${pid}`, adm),
    () => chamar('GET', '/api/aparelhos', adm),
  ]

  const resultado = []
  for (const usuarios of NIVEIS) {
    const tempos = []
    let erros = 0
    const fim = Date.now() + DURACAO
    async function usuario(u) {
      let k = u
      while (Date.now() < fim) {
        const t0 = process.hrtime.bigint()
        const r = await ops[k++ % ops.length]()
        tempos.push(Number(process.hrtime.bigint() - t0) / 1e6)
        if (r.status >= 400) erros++
      }
    }
    await Promise.all(Array.from({ length: usuarios }, (_, u) => usuario(u)))
    const linha = {
      usuarios,
      requisicoes: tempos.length,
      porSegundo: +(tempos.length / (DURACAO / 1000)).toFixed(1),
      medianaMs: +percentil(tempos, 50).toFixed(1),
      p95Ms: +percentil(tempos, 95).toFixed(1),
      maxMs: +Math.max(...tempos).toFixed(1),
      erros,
    }
    console.log(linha)
    resultado.push(linha)
  }
  require('node:fs').writeFileSync(__dirname + '/resultado_carga.json', JSON.stringify(resultado, null, 2))
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
