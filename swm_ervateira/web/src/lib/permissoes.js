// ---------------------------------------------------------------------------
// MATRIZ DE PERMISSÕES · espelho do que o back-end realmente aplica
// ---------------------------------------------------------------------------
// Esta tabela NÃO decide nada. Quem decide é o permitir() em
// src/middlewares/autorizacao.js, chamado nas rotas de cada módulo.
//
// Ela existe para que a tela de Configurações consiga mostrar, em um lugar só,
// o que hoje está espalhado por cinco arquivos de rota. Cada linha traz a rota
// que a aplica, para que a conferência seja possível sem sair da tela.
//
// Se uma rota mudar de permissão no back-end, ESTA LISTA precisa mudar junto.
// É uma duplicação consciente, do mesmo tipo que a de lib/calculo.js: aqui
// para documentar, lá para pré-visualizar — em nenhum dos dois casos para
// substituir o servidor.

export const PERFIS = [
  { id: 'OPERADOR_BALANCA', rotulo: 'Operador de balança', curto: 'Balança' },
  { id: 'ANALISTA_QUALIDADE', rotulo: 'Analista de qualidade', curto: 'Qualidade' },
  { id: 'COMPRADOR_AVALIADOR', rotulo: 'Comprador / avaliador', curto: 'Campo' },
  { id: 'ADMINISTRATIVO', rotulo: 'Administrativo', curto: 'Administrativo' },
]

const TODOS = PERFIS.map((p) => p.id)

export const OPERACOES = [
  {
    grupo: 'Recebimento',
    itens: [
      { nome: 'Consultar cargas e histórico', rota: 'GET /api/cargas', perfis: TODOS },
      { nome: 'Abrir uma carga e a memória de cálculo', rota: 'GET /api/cargas/:id', perfis: TODOS },
      { nome: 'Registrar pesagem e emitir ticket', rota: 'POST /api/cargas', perfis: ['OPERADOR_BALANCA', 'ADMINISTRATIVO'] },
    ],
  },
  {
    grupo: 'Qualidade',
    itens: [
      { nome: 'Ver a fila do laboratório', rota: 'GET /api/qualidade/fila', perfis: TODOS },
      { nome: 'Lançar análise e aplicar o desconto', rota: 'POST /api/qualidade/cargas/:id', perfis: ['ANALISTA_QUALIDADE', 'ADMINISTRATIVO'] },
    ],
  },
  {
    grupo: 'Campo e sincronização',
    itens: [
      { nome: 'Consultar avaliações de campo', rota: 'GET /api/avaliacoes', perfis: TODOS },
      { nome: 'Abrir uma avaliação e suas fotos', rota: 'GET /api/avaliacoes/:id', perfis: TODOS },
      { nome: 'Enviar o lote coletado no erval', rota: 'POST /api/sincronizacao', perfis: ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO'] },
      { nome: 'Enviar foto do erval', rota: 'POST /api/sincronizacao/fotos', perfis: ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO'] },
      { nome: 'Ver a taxa de sincronização', rota: 'GET /api/sincronizacao/resumo', perfis: TODOS },
      { nome: 'Ver o log de operações recebidas', rota: 'GET /api/sincronizacao/registros', perfis: TODOS },
    ],
  },
  {
    grupo: 'Cadastros',
    itens: [
      { nome: 'Consultar produtores e ervais', rota: 'GET /api/produtores', perfis: TODOS },
      { nome: 'Cadastrar produtor', rota: 'POST /api/produtores', perfis: ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO'] },
      { nome: 'Editar dados cadastrais e de pagamento', rota: 'PUT /api/produtores/:id', perfis: ['COMPRADOR_AVALIADOR', 'ADMINISTRATIVO'] },
    ],
  },
  {
    grupo: 'Financeiro',
    itens: [
      { nome: 'Consultar ordens de pagamento', rota: 'GET /api/pagamentos', perfis: TODOS },
      { nome: 'Emitir ordem do período', rota: 'POST /api/pagamentos', perfis: ['ADMINISTRATIVO'] },
      { nome: 'Confirmar pagamento', rota: 'POST /api/pagamentos/:id/confirmar', perfis: ['ADMINISTRATIVO'] },
    ],
  },
]

/** O administrativo passa em tudo, exatamente como no permitir() do back-end. */
export function podeNoPerfil(perfil, perfisDaOperacao) {
  return perfil === 'ADMINISTRATIVO' || perfisDaOperacao.includes(perfil)
}
