// ---------------------------------------------------------------------------
// API · cliente HTTP
// ---------------------------------------------------------------------------
// Este é o ÚNICO arquivo do front que fala diretamente com a API.
// Todos os outros passam por aqui.
//
// O que ele resolve de uma vez só:
//   · anexa o token JWT em toda requisição
//   · converte a resposta de JSON para objeto
//   · transforma erro da API em exceção com mensagem legível
//   · se o token venceu (401), limpa a sessão e manda para o login
//
// Sem isso, cada tela repetiria fetch, cabeçalho, tratamento de erro e
// verificação de token — e uma delas esqueceria algum.

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

/** Erro vindo da API, já com a mensagem que o back-end mandou. */
export class ErroApi extends Error {
  constructor(mensagem, status, detalhe) {
    super(mensagem)
    this.status = status
    this.detalhe = detalhe
  }
}

/**
 * Faz a requisição. O caminho é relativo: '/api/cargas'.
 * O proxy do Vite (ver vite.config.js) encaminha para a porta 3000.
 */
async function requisicao(caminho, { metodo = 'GET', corpo, semToken = false } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' }

  const token = lerToken()
  if (token && !semToken) cabecalhos.Authorization = `Bearer ${token}`

  const resposta = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
  })

  // 204 = sucesso sem conteúdo de volta
  if (resposta.status === 204) return null

  let dados = null
  try {
    dados = await resposta.json()
  } catch {
    dados = null
  }

  if (!resposta.ok) {
    // Token vencido ou inválido: derruba a sessão e volta para o login.
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
  del: (caminho) => requisicao(caminho, { metodo: 'DELETE' }),
}
