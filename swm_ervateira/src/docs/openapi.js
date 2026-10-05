// Documentação da API no formato OpenAPI 3, aberta em /api/docs.
// As rotas ficam numa tabela curta; os corpos detalhados são só os das
// operações principais.

const PERFIS = {
  todos: 'Qualquer usuário autenticado',
  balanca: 'OPERADOR_BALANCA, ADMINISTRATIVO, ADMINISTRADOR',
  qualidade: 'ANALISTA_QUALIDADE, ADMINISTRATIVO, ADMINISTRADOR',
  campo: 'COMPRADOR_AVALIADOR, ADMINISTRATIVO, ADMINISTRADOR',
  financeiro: 'ADMINISTRATIVO, ADMINISTRADOR',
  admin: 'Só ADMINISTRADOR',
}

const numero = { type: 'number' }
const texto = { type: 'string' }

const CORPOS = {
  login: {
    required: ['usuario', 'senha'],
    properties: { usuario: { ...texto, example: 'admin.matech' }, senha: { ...texto, example: 'matech123' } },
  },
  senha: { required: ['senhaAtual', 'senhaNova'], properties: { senhaAtual: texto, senhaNova: { ...texto, minLength: 6 } } },
  carga: {
    required: ['produtorId', 'tipoMateriaPrima', 'pesoBrutoKg'],
    properties: {
      produtorId: texto,
      tipoMateriaPrima: { type: 'string', enum: ['ERVA_MATE_NATIVA', 'ERVA_MATE_PLANTADA', 'PALITO', 'LENHA'] },
      pesoBrutoKg: { ...numero, example: 18450 },
      precoBaseKg: { ...numero, example: 4.85, description: 'Número, ou texto no padrão brasileiro ("4,85")' },
      motoristaId: texto, veiculoId: texto, ervalId: texto, avaliacaoId: texto,
      metragemM3: { ...numero, description: 'Só para lenha' },
      pesoEstimadoCampoKg: numero, observacoes: texto,
    },
  },
  tara: { required: ['taraKg'], properties: { taraKg: { ...numero, example: 11210 } } },
  analise: {
    required: ['palitoPercentual'],
    properties: {
      palitoPercentual: { ...numero, example: 34 }, umidadePercentual: numero, folhaPercentual: numero,
      aprovada: { type: 'boolean', default: true }, motivoReprovacao: texto, observacoes: texto,
    },
  },
  produtor: {
    required: ['nome', 'cpfCnpj', 'formaPagamento'],
    properties: {
      nome: texto, cpfCnpj: { ...texto, description: 'Dígito verificador conferido' }, telefone: texto,
      municipio: texto, uf: texto,
      formaPagamento: { type: 'string', enum: ['PIX', 'CONTA_BANCARIA', 'DINHEIRO'] },
      tipoChavePix: { type: 'string', enum: ['CPF', 'TELEFONE', 'EMAIL', 'ALEATORIA'] }, chavePix: texto,
      titularConta: texto, banco: texto, agencia: texto, conta: texto,
      tipoConta: { type: 'string', enum: ['CORRENTE', 'POUPANCA'] },
    },
  },
  lote: {
    required: ['dispositivoId', 'operacoes'],
    properties: {
      dispositivoId: texto,
      operacoes: {
        type: 'array', maxItems: 200,
        items: {
          type: 'object',
          required: ['clientId', 'entidade', 'payload'],
          properties: {
            clientId: { ...texto, description: 'Gerado no aparelho. Reenviar o mesmo clientId não duplica (idempotência).' },
            entidade: { type: 'string', enum: ['Produtor', 'ProdutorAlteracao', 'Erval', 'Avaliacao'] },
            criadoEmOrigem: { type: 'string', format: 'date-time' },
            payload: { type: 'object' },
          },
        },
      },
    },
  },
  contato: {
    required: ['dispositivoId'],
    properties: { dispositivoId: texto, naFila: { type: 'integer', minimum: 0 }, comErro: { type: 'integer', minimum: 0 } },
  },
}

// [método, caminho, grupo, resumo, perfis, corpo]
const ROTAS = [
  ['post', '/api/auth/login', 'Acesso', 'Entrar e receber o token JWT', null, 'login'],
  ['get', '/api/auth/eu', 'Acesso', 'Dados de quem está logado', 'todos'],
  ['post', '/api/auth/senha', 'Acesso', 'Trocar a própria senha', 'todos', 'senha'],

  ['get', '/api/cargas', 'Pesagem', 'Listar cargas (paginado, com busca)', 'todos'],
  ['get', '/api/cargas/{id}', 'Pesagem', 'Detalhe da carga', 'todos'],
  ['get', '/api/cargas/{id}/calculo', 'Pesagem', 'Peso líquido e valor calculados', 'todos'],
  ['post', '/api/cargas', 'Pesagem', 'Primeira pesagem (caminhão cheio)', 'balanca', 'carga'],
  ['patch', '/api/cargas/{id}/tara', 'Pesagem', 'Segunda pesagem (tara) e peso líquido', 'balanca', 'tara'],
  ['get', '/api/motoristas', 'Pesagem', 'Motoristas e veículos', 'todos'],
  ['post', '/api/motoristas', 'Pesagem', 'Cadastrar motorista', 'balanca'],
  ['put', '/api/motoristas/{id}', 'Pesagem', 'Alterar motorista', 'balanca'],
  ['post', '/api/motoristas/{id}/veiculos', 'Pesagem', 'Cadastrar veículo (tara por placa)', 'balanca'],

  ['get', '/api/qualidade/fila', 'Qualidade', 'Cargas esperando análise', 'qualidade'],
  ['post', '/api/qualidade/cargas/{cargaId}', 'Qualidade', 'Registrar análise da carga', 'qualidade', 'analise'],

  ['get', '/api/produtores', 'Cadastros', 'Listar produtores', 'todos'],
  ['get', '/api/produtores/{id}', 'Cadastros', 'Ficha do produtor', 'todos'],
  ['post', '/api/produtores', 'Cadastros', 'Cadastrar produtor', 'campo', 'produtor'],
  ['put', '/api/produtores/{id}', 'Cadastros', 'Alterar produtor (o CPF/CNPJ não muda)', 'campo', 'produtor'],

  ['get', '/api/pagamentos', 'Pagamentos', 'Ordens de pagamento', 'financeiro'],
  ['get', '/api/pagamentos/aguardando', 'Pagamentos', 'Cargas analisadas esperando ordem', 'financeiro'],
  ['get', '/api/pagamentos/previa', 'Pagamentos', 'Prévia da ordem antes de emitir', 'financeiro'],
  ['post', '/api/pagamentos', 'Pagamentos', 'Emitir ordem (preço acordado carga a carga)', 'financeiro'],
  ['post', '/api/pagamentos/{id}/confirmar', 'Pagamentos', 'Dar baixa (Pix feito fora do sistema)', 'financeiro'],

  ['get', '/api/avaliacoes', 'Campo e sincronização', 'Avaliações feitas em campo', 'campo'],
  ['get', '/api/avaliacoes/{id}', 'Campo e sincronização', 'Detalhe da avaliação com fotos', 'campo'],
  ['post', '/api/sincronizacao', 'Campo e sincronização', 'Receber lote do app (idempotente por clientId)', 'campo', 'lote'],
  ['post', '/api/sincronizacao/fotos', 'Campo e sincronização', 'Receber foto (corpo binário JPEG/PNG/WebP, tipo conferido pelos bytes)', 'campo'],
  ['get', '/api/sincronizacao/resumo', 'Campo e sincronização', 'Taxa de sincronização', 'campo'],
  ['get', '/api/sincronizacao/registros', 'Campo e sincronização', 'Registro de cada operação recebida', 'campo'],
  ['post', '/api/aparelhos/contato', 'Campo e sincronização', 'App informa quantos itens tem na fila', 'campo', 'contato'],
  ['get', '/api/aparelhos', 'Campo e sincronização', 'Aparelhos, último contato e fila', 'campo'],

  ['get', '/api/usuarios', 'Administração', 'Listar usuários', 'admin'],
  ['post', '/api/usuarios', 'Administração', 'Criar usuário', 'admin'],
  ['put', '/api/usuarios/{id}', 'Administração', 'Alterar usuário', 'admin'],
  ['put', '/api/usuarios/{id}/senha', 'Administração', 'Redefinir senha', 'admin'],
  ['get', '/api/auditoria', 'Administração', 'Registro de alterações', 'admin'],
  ['get', '/api/auditoria/autores', 'Administração', 'Quem aparece no registro', 'admin'],
]

function montar() {
  const paths = {
    '/health': { get: { tags: ['Sistema'], summary: 'Saúde da API e do banco', security: [], responses: { 200: { description: 'OK' } } } },
  }
  for (const [metodo, caminho, grupo, resumo, perfis, corpo] of ROTAS) {
    const parametros = [...caminho.matchAll(/\{(\w+)\}/g)].map(([, nome]) => ({
      name: nome, in: 'path', required: true, schema: { type: 'string' },
    }))
    const op = {
      tags: [grupo],
      summary: resumo,
      description: perfis ? `Perfis: ${PERFIS[perfis]}` : 'Não exige token.',
      security: perfis ? [{ token: [] }] : [],
      responses: {
        200: { description: 'OK' },
        400: { description: 'Dado inválido (a mensagem diz o quê)' },
        ...(perfis ? { 401: { description: 'Sem token ou token vencido' }, 403: { description: 'Perfil sem permissão' } } : {}),
      },
    }
    if (parametros.length) op.parameters = parametros
    if (corpo) {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: { type: 'object', ...CORPOS[corpo] } } },
      }
    }
    paths[caminho] ??= {}
    paths[caminho][metodo] = op
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'MATECH · API',
      version: '1.0.0',
      description:
        'Gestão do recebimento de matéria-prima (erva-mate e lenha) em ervateiras. ' +
        'Para testar: faça o login, copie o token e use o botão Authorize.',
    },
    components: { securitySchemes: { token: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    security: [{ token: [] }],
    paths,
  }
}

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MATECH · API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="docs"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#docs', persistAuthorization: true })
  </script>
</body>
</html>`

module.exports = { montar, PAGINA, ROTAS }
