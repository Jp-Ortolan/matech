// ---------------------------------------------------------------------------
// API · funções por assunto
// ---------------------------------------------------------------------------
// Cada função aqui corresponde a uma rota do back-end. As telas chamam estas
// funções e nunca escrevem o endereço da rota direto — assim, se uma rota
// mudar de endereço, só este arquivo muda.

import { api, guardarSessao, limparSessao } from './client'

/**
 * Monta a query string só com os filtros que foram preenchidos.
 * Sem isso, um filtro vazio viraria "?produtorId=undefined" e o back-end
 * tentaria buscar um produtor chamado "undefined".
 */
function montarQuery(filtros = {}) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') params.append(chave, valor)
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ---------------------------- autenticação ----------------------------
export const auth = {
  async entrar(usuario, senha) {
    const dados = await api.post('/api/auth/login', { usuario, senha }, { semToken: true })
    guardarSessao(dados.token, dados.usuario)
    return dados.usuario
  },
  sair() {
    limparSessao()
  },
  eu: () => api.get('/api/auth/eu'),
  // Troca da própria senha. O servidor tira o id do token: não há como
  // pedir a troca da senha de outra pessoa por esta rota.
  trocarSenha: (senhaAtual, senhaNova) =>
    api.post('/api/auth/senha', { senhaAtual, senhaNova }),
}

// ----------------------- usuários (só administrador) ------------------------
// Todas passam por apenas('ADMINISTRADOR') no servidor. Um usuário comum que
// chamasse estas rotas à mão receberia 403 — o menu escondido é conveniência,
// não a proteção.
export const usuarios = {
  listar: () => api.get('/api/usuarios'),
  criar: (dados) => api.post('/api/usuarios', dados),
  atualizar: (id, dados) => api.put(`/api/usuarios/${id}`, dados),
  redefinirSenha: (id, senha) => api.put(`/api/usuarios/${id}/senha`, { senha }),
}

// ---------------------------- produtores ------------------------------
export const produtores = {
  listar: (busca) => api.get('/api/produtores' + montarQuery({ busca })),
  buscar: (id) => api.get(`/api/produtores/${id}`),
  // O dado pessoal em claro. Vem mascarado em listar e buscar; esta rota é o
  // pedido explícito, e o servidor devolve apenas o que o perfil pode ver.
  criar: (dados) => api.post('/api/produtores', dados),
  atualizar: (id, dados) => api.put(`/api/produtores/${id}`, dados),
}

// ------------------------------ cargas --------------------------------
export const cargas = {
  listar: (filtros = {}) => api.get('/api/cargas' + montarQuery(filtros)),
  buscar: (id) => api.get(`/api/cargas/${id}`),
  calculo: (id) => api.get(`/api/cargas/${id}/calculo`),
  registrar: (dados) => api.post('/api/cargas', dados),
}

// ---------------------------- motoristas ------------------------------
// Cadastrados na balança, por quem está lá: o motorista aparece na hora, e
// mandar a pessoa procurar o administrativo pararia a fila.
export const motoristas = {
  listar: (busca) => api.get('/api/motoristas' + montarQuery({ busca })),
  criar: (dados) => api.post('/api/motoristas', dados),
  atualizar: (id, dados) => api.put(`/api/motoristas/${id}`, dados),
  adicionarVeiculo: (id, veiculo) => api.post(`/api/motoristas/${id}/veiculos`, veiculo),
}

// ------------------------ avaliações de campo -------------------------
// O que o aplicativo produziu no erval. Só leitura: a única porta de entrada
// de uma avaliação é a sincronização.
export const avaliacoesCampo = {
  listar: (filtros = {}) => api.get('/api/avaliacoes' + montarQuery(filtros)),
  buscar: (id) => api.get(`/api/avaliacoes/${id}`),
}

// --------------------------- sincronização ----------------------------
// Estas rotas existem no servidor desde o início e são a evidência do
// Quadro 7. A tela de sincronização é o que as torna visíveis.
export const sincronizacao = {
  resumo: (dispositivoId) => api.get('/api/sincronizacao/resumo' + montarQuery({ dispositivoId })),
  registros: (filtros = {}) => api.get('/api/sincronizacao/registros' + montarQuery(filtros)),
}

// ---------------------------- auditoria -------------------------------
// Só leitura, porque a API só oferece leitura: o log cresce a partir das
// operações reais, e não de alguém escrevendo nele.
export const auditoria = {
  listar: (filtros = {}) => api.get('/api/auditoria' + montarQuery(filtros)),
  autores: () => api.get('/api/auditoria/autores'),
}

// ---------------------------- qualidade -------------------------------
export const qualidade = {
  fila: () => api.get('/api/qualidade/fila'),
  registrarAnalise: (cargaId, dados) => api.post(`/api/qualidade/cargas/${cargaId}`, dados),
}

// ---------------------------- pagamentos ------------------------------
export const pagamentos = {
  // Tudo que está esperando precificação, de todos os produtores de uma vez.
  // Sem filtro nenhum: a pergunta de quem abre a tela é 'quem está esperando
  // pagamento?', e ela não se responde escolhendo um produtor por vez.
  aguardando: () => api.get('/api/pagamentos/aguardando'),
  // O que entraria na ordem, antes de emitir. É a tela que permite informar o
  // preço olhando para a carga concreta em vez de digitar no escuro.
  previa: (filtros) => api.get('/api/pagamentos/previa' + montarQuery(filtros)),
  listar: (filtros = {}) => api.get('/api/pagamentos' + montarQuery(filtros)),
  gerar: (dados) => api.post('/api/pagamentos', dados),
  confirmar: (id) => api.post(`/api/pagamentos/${id}/confirmar`),
}

// -------------------------- parâmetros ---------------------------------
// A régua da ervateira: limite de palito, desconto por ponto e os limites de
// reprovação. Ler é aberto — o analista precisa ver o limite ao lançar a
// análise. Gravar exige o perfil administrativo.
export const parametros = {
  qualidade: () => api.get('/api/parametros/qualidade'),
  salvarQualidade: (dados) => api.put('/api/parametros/qualidade', dados),
}

// ------------------------------- painel --------------------------------
// UMA rota para a tela inteira. Antes o painel montava os números com sete
// requisições e somava 500 linhas no navegador — e passava a mentir a partir
// da carga 501. Agora quem soma é o banco.
export const dashboard = {
  carregar: () => api.get('/api/dashboard'),
}

// ------------------------------ sistema -------------------------------
// /health não fica sob /api porque não é recurso de negócio: é a verificação
// de que a API responde e de que o banco está acessível. A tela de
// Configurações usa isto para mostrar o estado do sistema.
export const sistema = {
  saude: () => api.get('/health'),
}
