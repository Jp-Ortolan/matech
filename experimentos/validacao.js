// Experimento 2: entradas inválidas inseridas de propósito.
// Cada caso é enviado à API; conta-se quantos foram bloqueados (4xx) e
// quantos casos válidos de controle foram aceitos (2xx).
const { gerador, cpf, cnpj, chamar, entrar } = require('./comum')

const rnd = gerador(Date.now() % 1000003)
const sufixo = Date.now().toString(36)

function cpfErrado() {
  const c = cpf(rnd)
  return c.slice(0, 10) + ((Number(c[10]) + 1 + Math.floor(rnd() * 8)) % 10)
}

// Nomes realistas: desde 16/10 a API recusa nomes como "Produtor teste".
const NOMES = ['Antônio', 'Maria', 'José', 'Ana', 'Pedro', 'Luciana', 'Valdir', 'Rosane', 'Claudemir', 'Irene']
const SOBRENOMES = ['Kloster', 'Ribeiro dos Santos', 'Wosniak', 'Camargo', 'Lemes', 'Prestes', 'Schmidt', 'Andrade']

function produtor(doc, extra = {}) {
  const nome = NOMES[Math.floor(rnd() * NOMES.length)] + ' ' + SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]
  return { nome, cpfCnpj: doc, municipio: 'Guarapuava', uf: 'PR', formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: doc, ...extra }
}

;(async () => {
  const campo = await entrar('marcos.ferrari')
  const balanca = await entrar('rogerio.anselmo')
  const qualidade = await entrar('cristiane.modesto')

  const linhas = []   // { grupo, categoria, esperado: 'bloquear'|'aceitar', status }
  async function caso(grupo, categoria, esperado, req) {
    const r = await req()
    linhas.push({ grupo, categoria, esperado, status: r.status, ok: esperado === 'bloquear' ? r.status >= 400 && r.status < 500 : r.status < 300, msg: r.json?.erro })
    return r
  }

  // Produtores válidos de controle (servem de base para as cargas).
  const produtores = []
  for (let i = 0; i < 20; i++) {
    const doc = i % 4 === 0 ? cnpj(rnd) : cpf(rnd)
    const r = await caso('Cadastro de produtor', 'Produtor válido (controle)', 'aceitar', () => chamar('POST', '/api/produtores', campo, produtor(doc)))
    if (r.status === 201) produtores.push({ id: r.json.id, doc })
  }
  for (let i = 0; i < 20; i++)
    await caso('Cadastro de produtor', 'CPF com dígito verificador errado', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(cpfErrado())))
  for (let i = 0; i < 5; i++) {
    const d = String(i + 1).repeat(11)
    await caso('Cadastro de produtor', 'CPF com todos os dígitos iguais', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(d)))
  }
  for (let i = 0; i < 5; i++) {
    const c = cnpj(rnd)
    const errado = c.slice(0, 13) + ((Number(c[13]) + 3) % 10)
    await caso('Cadastro de produtor', 'CNPJ com dígito verificador errado', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(errado, { tipoChavePix: 'CNPJ' })))
  }
  for (let i = 0; i < 5; i++)
    await caso('Cadastro de produtor', 'CPF/CNPJ já cadastrado', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(produtores[i].doc)))
  for (const n of ['Jo', 'aaaaaaa', 'Joãooooooo Silva', '12', 'Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx Souza'])
    await caso('Cadastro de produtor', 'Nome sem sentido (curto, repetido ou palavra longa)', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(cpf(rnd), { nome: n })))
  for (let i = 0; i < 5; i++)
    await caso('Cadastro de produtor', 'Nome acima do limite de caracteres', 'bloquear', () => chamar('POST', '/api/produtores', campo, produtor(cpf(rnd), { nome: 'X'.repeat(121 + i * 10) })))

  // Pesagem.
  const novaCarga = (extra) => chamar('POST', '/api/cargas', balanca, { produtorId: produtores[Math.floor(rnd() * produtores.length)].id, tipoMateriaPrima: 'ERVA_MATE_NATIVA', pesoBrutoKg: '18.540', precoBaseKg: '1,35', ...extra })
  const cargas = []
  for (let i = 0; i < 20; i++) {
    const bruto = (12000 + Math.floor(rnd() * 15000)).toLocaleString('pt-BR') + ',5'
    const r = await caso('Pesagem', 'Entrada válida, padrão brasileiro (controle)', 'aceitar', () => novaCarga({ pesoBrutoKg: bruto }))
    if (r.status === 201) cargas.push(r.json)
  }
  for (const v of ['4.85', '1,234.5', '18540.75', 'abc', '12,5,3', '1.2.3', '18 540', '1e4', ',5', '18540,'])
    await caso('Pesagem', 'Número em formato ambíguo ou inválido', 'bloquear', () => novaCarga({ pesoBrutoKg: v }))
  for (const v of ['0', '-100', '0,0', '-18.540', '-0,5'])
    await caso('Pesagem', 'Peso bruto zero ou negativo', 'bloquear', () => novaCarga({ pesoBrutoKg: v }))
  for (const v of ['500', '999,9', '80.000,1', '95.000', '250.000'])
    await caso('Pesagem', 'Peso bruto fora da faixa de 1.000 a 80.000 kg', 'bloquear', () => novaCarga({ pesoBrutoKg: v }))
  for (const v of ['100,01', '135', '1.350', '480', '1.000,00'])
    await caso('Pesagem', 'Preço acima de R$ 100,00 por quilograma', 'bloquear', () => novaCarga({ precoBaseKg: v }))
  for (const v of ['0', '-1,35', '1.35', 'R$ 1,35', 'um real'])
    await caso('Pesagem', 'Preço zero, negativo ou ambíguo', 'bloquear', () => novaCarga({ precoBaseKg: v }))
  for (let i = 0; i < 5; i++)
    await caso('Pesagem', 'Metragem informada para erva-mate', 'bloquear', () => novaCarga({ metragemM3: '30' }))
  for (const v of ['501', '1.200', '45000', '600,5', '999'])
    await caso('Pesagem', 'Metragem de lenha acima do plausível', 'bloquear', () => novaCarga({ tipoMateriaPrima: 'LENHA', metragemM3: v }))
  // Tara: as 10 primeiras recebem tara inválida, depois todas recebem tara válida.
  for (let i = 0; i < 10; i++) {
    const c = cargas[i]
    const bruto = Number(c.pesoBrutoKg)
    const v = i % 2 === 0 ? (bruto + 100).toLocaleString('pt-BR') : bruto.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
    await caso('Pesagem', 'Tara maior ou igual ao peso bruto', 'bloquear', () => chamar('PATCH', `/api/cargas/${c.id}/tara`, balanca, { taraKg: v }))
  }
  for (const c of cargas)
    await caso('Pesagem', 'Tara válida (controle)', 'aceitar', () => chamar('PATCH', `/api/cargas/${c.id}/tara`, balanca, { taraKg: '9.850' }))

  // Análise de qualidade.
  for (let i = 0; i < 10; i++) {
    const v = ['101', '-1', '150,5', '-0,5', '200', '4.5', 'dez', '100,01', '1000', '-50'][i]
    await caso('Análise de qualidade', 'Percentual fora de 0–100 ou ambíguo', 'bloquear', () => chamar('POST', `/api/qualidade/cargas/${cargas[i].id}`, qualidade, { palitoPercentual: v }))
  }
  for (let i = 0; i < 10; i++)
    await caso('Análise de qualidade', 'Análise válida (controle)', 'aceitar', () => chamar('POST', `/api/qualidade/cargas/${cargas[i].id}`, qualidade, { palitoPercentual: (8 + i).toString() + ',5', umidadePercentual: '42' }))
  for (let i = 0; i < 5; i++)
    await caso('Análise de qualidade', 'Segunda análise para a mesma carga', 'bloquear', () => chamar('POST', `/api/qualidade/cargas/${cargas[i].id}`, qualidade, { palitoPercentual: '10' }))

  // Fotos: arquivo que não é imagem, com tipo declarado de imagem.
  const aval = (await chamar('GET', '/api/avaliacoes', campo)).json
  const avalClientId = (Array.isArray(aval) ? aval : aval.itens || aval.dados || [])[0]?.clientId
  for (let i = 0; i < 5; i++) {
    const corpo = Buffer.from(['%PDF-1.4 falso', '<script>x</script>', 'MZ executável', 'texto qualquer', '{"json":true}'][i])
    const r = await fetch(require('./comum').BASE + '/api/sincronizacao/fotos', { method: 'POST', body: corpo,
      headers: { 'content-type': 'image/jpeg', authorization: 'Bearer ' + campo, 'x-client-id': `fx-${sufixo}-${i}`, 'x-avaliacao-client-id': avalClientId } })
    linhas.push({ grupo: 'Fotos', categoria: 'Arquivo que não é imagem enviado como JPEG', esperado: 'bloquear', status: r.status, ok: r.status >= 400 && r.status < 500 })
  }

  // Acesso: sem token e com perfil sem permissão.
  for (const [m, c] of [['GET', '/api/cargas'], ['GET', '/api/produtores'], ['GET', '/api/pagamentos'], ['GET', '/api/usuarios'], ['POST', '/api/sincronizacao']])
    await caso('Acesso', 'Requisição sem login', 'bloquear', () => chamar(m, c, null, m === 'POST' ? {} : undefined))
  for (const [tk, m, c] of [[balanca, 'GET', '/api/pagamentos'], [qualidade, 'POST', '/api/cargas'], [campo, 'GET', '/api/usuarios'], [balanca, 'GET', '/api/auditoria'], [qualidade, 'POST', '/api/sincronizacao']])
    await caso('Acesso', 'Perfil sem permissão para a rota', 'bloquear', () => chamar(m, c, tk, m === 'POST' ? {} : undefined))
  await caso('Acesso', 'Token adulterado', 'bloquear', () => chamar('GET', '/api/cargas', campo.slice(0, -3) + 'abc'))

  // Resumo por categoria.
  const resumo = {}
  for (const l of linhas) {
    const k = l.grupo + ' | ' + l.categoria
    resumo[k] ??= { grupo: l.grupo, categoria: l.categoria, esperado: l.esperado, casos: 0, corretos: 0, status: new Set() }
    resumo[k].casos++; if (l.ok) resumo[k].corretos++; resumo[k].status.add(l.status)
  }
  const tabela = Object.values(resumo).map((r) => ({ ...r, status: [...r.status].join('/') }))
  console.table(tabela)
  const falhas = linhas.filter((l) => !l.ok)
  if (falhas.length) console.log('FALHAS', falhas)
  require('node:fs').writeFileSync(__dirname + '/resultado_validacao.json', JSON.stringify({ tabela, linhas }, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })
