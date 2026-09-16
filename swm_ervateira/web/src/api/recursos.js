import { api, guardarSessao, limparSessao } from './client'

function montarQuery(filtros = {}) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') params.append(chave, valor)
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

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
  trocarSenha: (senhaAtual, senhaNova) =>
    api.post('/api/auth/senha', { senhaAtual, senhaNova }),
}

export const usuarios = {
  listar: () => api.get('/api/usuarios'),
  criar: (dados) => api.post('/api/usuarios', dados),
  atualizar: (id, dados) => api.put(`/api/usuarios/${id}`, dados),
  redefinirSenha: (id, senha) => api.put(`/api/usuarios/${id}/senha`, { senha }),
}

export const produtores = {
  listar: (busca) => api.get('/api/produtores' + montarQuery({ busca })),
  buscar: (id) => api.get(`/api/produtores/${id}`),
  criar: (dados) => api.post('/api/produtores', dados),
  atualizar: (id, dados) => api.put(`/api/produtores/${id}`, dados),
}

export const cargas = {
  listar: (filtros = {}) => api.get('/api/cargas' + montarQuery(filtros)),
  buscar: (id) => api.get(`/api/cargas/${id}`),
  calculo: (id) => api.get(`/api/cargas/${id}/calculo`),
  registrar: (dados) => api.post('/api/cargas', dados),
  fecharTara: (id, taraKg) => api.patch(`/api/cargas/${id}/tara`, { taraKg }),
}

export const motoristas = {
  listar: (busca) => api.get('/api/motoristas' + montarQuery({ busca })),
  criar: (dados) => api.post('/api/motoristas', dados),
  atualizar: (id, dados) => api.put(`/api/motoristas/${id}`, dados),
  adicionarVeiculo: (id, veiculo) => api.post(`/api/motoristas/${id}/veiculos`, veiculo),
}

export const avaliacoesCampo = {
  listar: (filtros = {}) => api.get('/api/avaliacoes' + montarQuery(filtros)),
  buscar: (id) => api.get(`/api/avaliacoes/${id}`),
}

export const sincronizacao = {
  resumo: (dispositivoId) => api.get('/api/sincronizacao/resumo' + montarQuery({ dispositivoId })),
  registros: (filtros = {}) => api.get('/api/sincronizacao/registros' + montarQuery(filtros)),
}

export const auditoria = {
  listar: (filtros = {}) => api.get('/api/auditoria' + montarQuery(filtros)),
  autores: () => api.get('/api/auditoria/autores'),
}

export const qualidade = {
  fila: () => api.get('/api/qualidade/fila'),
  registrarAnalise: (cargaId, dados) => api.post(`/api/qualidade/cargas/${cargaId}`, dados),
}

export const pagamentos = {
  aguardando: () => api.get('/api/pagamentos/aguardando'),
  previa: (filtros) => api.get('/api/pagamentos/previa' + montarQuery(filtros)),
  listar: (filtros = {}) => api.get('/api/pagamentos' + montarQuery(filtros)),
  gerar: (dados) => api.post('/api/pagamentos', dados),
  confirmar: (id) => api.post(`/api/pagamentos/${id}/confirmar`),
}

export const sistema = {
  saude: () => api.get('/health'),
}
