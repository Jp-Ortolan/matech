// Conta o tamanho da base no momento da medição (vai para o texto da Seção 5.9).
const { Client } = require('../swm_ervateira/node_modules/pg')
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
  const r = {}
  for (const t of ['produtores', 'ervais', 'avaliacoes', 'cargas', 'ordens_pagamento', 'registros_sincronizacao'])
    r[t] = Number((await db.query(`select count(*) n from ${t}`)).rows[0].n)
  console.log(JSON.stringify(r))
  const etapa = process.argv[2] || 'base'
  require('node:fs').writeFileSync(__dirname + `/resultado_base_${etapa}.json`, JSON.stringify(r, null, 2))
  await db.end()
})().catch((e) => { console.error(e); process.exit(1) })
