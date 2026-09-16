const CHAVE_TOKEN = 'matech.token'
const CHAVE_USUARIO = 'matech.usuario'

export function guardarSessao(token, usuario) {
  localStorage.setItem(CHAVE_TOKEN, token)
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario))
}

export function lerToken() {
  return localStorage.getItem(CHAVE_TOKEN)
}

export function lerUsuario() {
  const bruto = localStorage.getItem(CHAVE_USUARIO)
  return bruto ? JSON.parse(bruto) : null
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_USUARIO)
}

export class ErroApi extends Error {
  constructor(mensagem, status, detalhe) {
    super(mensagem)
    this.status = status
    this.detalhe = detalhe
  }
}

async function requisicao(caminho, { metodo = 'GET', corpo, semToken = false } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' }

  const token = lerToken()
  if (token && !semToken) cabecalhos.Authorization = `Bearer ${token}`

  const resposta = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
  })

  if (resposta.status === 204) return null

  let dados = null
  try {
    dados = await resposta.json()
  } catch {
    dados = null
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && !semToken) {
      limparSessao()
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    throw new ErroApi(
      dados?.erro || 'Não foi possível concluir a operação',
      resposta.status,
      dados?.detalhe
    )
  }

  return dados
}

export const api = {
  get: (caminho) => requisicao(caminho),
  post: (caminho, corpo, opcoes) => requisicao(caminho, { metodo: 'POST', corpo, ...opcoes }),
  put: (caminho, corpo) => requisicao(caminho, { metodo: 'PUT', corpo }),
  patch: (caminho, corpo) => requisicao(caminho, { metodo: 'PATCH', corpo }),
  del: (caminho) => requisicao(caminho, { metodo: 'DELETE' }),
}
