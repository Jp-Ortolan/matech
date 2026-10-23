// Experimento 3: conferência dos cálculos.
// (a) gera ordens de pagamento pela API para as cargas analisadas e confere,
//     item a item, peso líquido, valor e total com uma conta independente;
// (b) compara a função de cálculo com aritmética decimal exata em 10.000
//     combinações aleatórias de peso e preço.
const { gerador, chamar, entrar } = require('./comum')
const { calcularPagamento } = require('../swm_ervateira/src/modules/cargas/cargas.service')

// Conta exata em inteiros: peso com 2 casas x preço com 4 casas = 6 casas.
// Arredondamento para o centavo pela ABNT NBR 5891 (o mesmo que o sistema
// adota desde 16/10/2026): o meio centavo vai para o centavo par.
let meiosCentavos = 0
function valorExato(pesoTexto, precoTexto, contarMeio = false) {
  const casas = (t, n) => { const [i, d = ''] = String(t).split('.'); return BigInt(i + d.padEnd(n, '0').slice(0, n)) }
  const prod = casas(pesoTexto, 2) * casas(precoTexto, 4)          // 6 casas
  let centavos = prod / 10000n
  const resto = prod % 10000n
  if (resto > 5000n || (resto === 5000n && centavos % 2n === 1n)) centavos += 1n
  if (resto === 5000n && contarMeio) meiosCentavos++
  return Number(centavos) / 100
}

;(async () => {
  const adm = await entrar('solange.petry')
  const aguardando = (await chamar('GET', '/api/pagamentos/aguardando', adm)).json
  const grupos = Array.isArray(aguardando) ? aguardando : aguardando.produtores || aguardando.itens || []
  let ordensGeradas = 0
  for (const g of grupos) {
    const produtorId = g.produtor.id
    const precos = g.cargas.map((c) => ({ cargaId: c.id, precoKg: String(c.precoSugeridoKg ?? 1.35).replace('.', ',') }))
    const r = await chamar('POST', '/api/pagamentos', adm, { produtorId, periodoInicio: '2026-01-01', periodoFim: '2026-12-31', precos })
    if (r.status === 201) ordensGeradas++
    else console.error('ordem não gerada', r.status, r.json)
  }

  const ordens = (await chamar('GET', '/api/pagamentos', adm)).json.ordens
  let itens = 0, itensCertos = 0, totaisCertos = 0, cargasConferidas = 0, liquidoCerto = 0
  for (const o of ordens) {
    let soma = 0
    for (const i of o.itens) {
      itens++
      const esperado = valorExato(i.pesoLiquidoKg, i.precoKg)
      if (Math.abs(esperado - Number(i.valor)) < 1e-9) itensCertos++
      soma += esperado
      const carga = (await chamar('GET', `/api/cargas/${i.cargaId}`, adm)).json
      cargasConferidas++
      const liq = Number(carga.pesoBrutoKg) - Number(carga.taraKg)
      if (Math.abs(liq - Number(carga.pesoLiquidoKg)) < 1e-6) liquidoCerto++
    }
    if (Math.abs(Number(soma.toFixed(2)) - Number(o.valorTotal)) < 1e-9) totaisCertos++
  }

  // (b) função de cálculo x conta exata.
  const rnd = gerador(2026)
  let combinacoes = 0, iguais = 0, maiorDiferenca = 0
  const exemplos = []
  for (let k = 0; k < 10000; k++) {
    const peso = (Math.floor(rnd() * 4000000) + 100) / 100        // 1,00 a 40.000,00 kg
    const preco = (Math.floor(rnd() * 60000) + 1) / 10000         // 0,0001 a 6,0000 R$/kg
    const calc = calcularPagamento({ pesoLiquidoKg: peso, precoBaseKg: preco }).valorTotal
    const exato = valorExato(peso.toFixed(2), preco.toFixed(4), true)
    combinacoes++
    const d = Math.abs(calc - exato)
    if (d < 1e-9) iguais++
    else if (exemplos.length < 5) exemplos.push({ peso, preco, calc, exato })
    maiorDiferenca = Math.max(maiorDiferenca, d)
  }

  const resultado = { ordensGeradas, ordens: ordens.length, itens, itensCertos, totaisCertos, cargasConferidas, liquidoCerto,
    funcao: { regra: 'ABNT NBR 5891 (meio centavo para o par)', meiosCentavos, combinacoes, iguais, diferentes: combinacoes - iguais, maiorDiferenca: Number(maiorDiferenca.toFixed(4)), exemplos } }
  console.log(JSON.stringify(resultado, null, 2))
  require('node:fs').writeFileSync(__dirname + '/resultado_calculos.json', JSON.stringify(resultado, null, 2))
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
