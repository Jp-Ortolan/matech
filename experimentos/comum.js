// Funções usadas pelos experimentos.
const BASE = process.env.API || 'http://localhost:3333'

// Gerador pseudoaleatório com semente, para o experimento poder ser repetido.
function gerador(semente) {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dv(digitos, pesos) {
  const soma = pesos.reduce((t, p, i) => t + digitos[i] * p, 0)
  const r = soma % 11
  return r < 2 ? 0 : 11 - r
}

function cpf(rnd) {
  const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10))
  d.push(dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]))
  d.push(dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]))
  return d.join('')
}

function cnpj(rnd) {
  const d = Array.from({ length: 8 }, () => Math.floor(rnd() * 10)).concat([0, 0, 0, 1])
  d.push(dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  d.push(dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return d.join('')
}

async function chamar(metodo, caminho, token, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json }
}

async function entrar(usuario) {
  const r = await chamar('POST', '/api/auth/login', null, { usuario, senha: process.env.SENHA_SEED || 'Senha123' })
  if (r.status !== 200) throw new Error('login falhou: ' + JSON.stringify(r.json))
  return r.json.token
}

function percentil(lista, p) {
  const o = [...lista].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)]
}

module.exports = { BASE, gerador, cpf, cnpj, chamar, entrar, percentil }
