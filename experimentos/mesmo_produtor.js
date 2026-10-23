// Experimento 1c: o mesmo produtor cadastrado offline em dois aparelhos.
const { Client } = require('../swm_ervateira/node_modules/pg')
const { gerador, cpf, chamar, entrar } = require('./comum')
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
  const t = await entrar('marcos.ferrari'); const rnd = gerador(Date.now() % 1000003); const pref = 'dup-' + Date.now()
  let casos = 0, unicos = 0, ervaisLigados = 0
  for (let i = 0; i < 10; i++) {
    const doc = cpf(rnd)
    for (const ap of ['A', 'B']) {
      const p = `${pref}-${i}-${ap}`
      const ops = [{ clientId: p + 'p', entidade: 'Produtor', payload: { nome: ['Antônio Kloster', 'Maria Camargo', 'José Prestes', 'Ana Lemes', 'Valdir Schmidt'][i % 5], cpfCnpj: doc, formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: doc } },
        { clientId: p + 'e', entidade: 'Erval', payload: { produtorClientId: p + 'p', identificacao: 'Erval ' + ap, tipoErva: 'NATIVA', quantidadeEstimadaKg: '1000' } }]
      let r = await chamar('POST', '/api/sincronizacao', t, { dispositivoId: pref + ap, operacoes: ops })
      // como o app: se o produtor voltou DUPLICADO, o erval passa a apontar para o id do servidor
      const rp = r.json.resultados[0]
      if (r.json.resultados[1].situacao === 'DEPENDENCIA_PENDENTE') {
        ops[1].payload.produtorId = rp.id
        r = await chamar('POST', '/api/sincronizacao', t, { dispositivoId: pref + ap, operacoes: [ops[1]] })
      }
    }
    casos++
    const n = Number((await db.query('select count(*) n from produtores where "cpfCnpj"=$1', [doc])).rows[0].n)
    if (n === 1) unicos++
    const e = Number((await db.query('select count(*) n from ervais e join produtores p on p.id=e."produtorId" where p."cpfCnpj"=$1', [doc])).rows[0].n)
    if (e === 2) ervaisLigados++
  }
  const r = { casos, produtorUnico: unicos, doisErvaisNoMesmoProdutor: ervaisLigados }
  console.log(JSON.stringify(r)); require('node:fs').writeFileSync(__dirname + '/resultado_mesmo_produtor.json', JSON.stringify(r, null, 2)); await db.end()
})().catch((e) => { console.error(e); process.exit(1) })
