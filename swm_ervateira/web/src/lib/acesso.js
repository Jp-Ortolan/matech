// ---------------------------------------------------------------------------
// TELAS DO SISTEMA · o que cada perfil enxerga, e onde ele começa
// ---------------------------------------------------------------------------
// ESTE ARQUIVO NÃO DECIDE NADA. Ele declara, por tela, QUAL PERFIL O SERVIDOR
// EXIGE na rota que aquela tela consome. A decisão continua sendo do
// middlewares/autorizacao.js, chamado em cada rota do back-end; aqui só está
// escrito o que já está lá, para o menu não mostrar caminho sem saída.
//
// A correspondência, rota por rota:
//
//   /              GET /api/cargas            livre para autenticado
//   /pesagem       GET /api/cargas            livre para autenticado
//   /avaliacoes    GET /api/qualidade/fila    permitir('ANALISTA_QUALIDADE')
//   /campo         GET /api/avaliacoes        permitir('COMPRADOR_AVALIADOR')
//   /sincronizacao GET /api/sincronizacao/*   permitir('COMPRADOR_AVALIADOR')
//   /produtores    GET /api/produtores        livre para autenticado
//   /materia-prima GET /api/cargas            livre para autenticado
//   /pagamentos    GET /api/pagamentos        permitir('ADMINISTRATIVO')
//   /relatorios    GET /api/cargas            livre — a aba financeira some
//   /usuarios      GET /api/usuarios          apenas('ADMINISTRADOR')
//
// Se alguém mudar um permitir() no servidor e esquecer desta lista, o efeito é
// um item de menu que leva a uma tela com erro 403 — feio, mas inofensivo.
// O contrário não acontece: apagar um item daqui não abre nada.
//
// `perfis: null` quer dizer que a rota é aberta a qualquer autenticado.
// `exclusivo: true` marca as telas que passam por apenas() em vez de
// permitir() — nelas o administrativo NÃO entra, e por isso são verificadas
// com ehAdministrador e não com podeFazer.

export const SECOES = [
  {
    secao: 'OPERAÇÃO',
    itens: [
      { rotulo: 'Dashboard', para: '/', perfis: null },
      { rotulo: 'Pesagem', para: '/pesagem', perfis: null },
      { rotulo: 'Avaliações', para: '/avaliacoes', perfis: ['ANALISTA_QUALIDADE'] },
    ],
  },
  {
    // Seção própria, e não um item solto em OPERAÇÃO, porque o que vem do
    // aplicativo tem uma natureza diferente do resto: não foi digitado aqui,
    // chegou de fora, e pode estar a caminho.
    secao: 'CAMPO',
    itens: [
      { rotulo: 'Avaliações de campo', para: '/campo', perfis: ['COMPRADOR_AVALIADOR'] },
      { rotulo: 'Sincronização', para: '/sincronizacao', perfis: ['COMPRADOR_AVALIADOR'] },
    ],
  },
  {
    secao: 'CADASTROS',
    itens: [
      { rotulo: 'Produtores', para: '/produtores', perfis: null },
      { rotulo: 'Matéria-prima', para: '/materia-prima', perfis: null },
    ],
  },
  {
    secao: 'FINANCEIRO',
    itens: [
      { rotulo: 'Pagamentos', para: '/pagamentos', perfis: ['ADMINISTRATIVO'] },
      { rotulo: 'Relatórios', para: '/relatorios', perfis: null },
    ],
  },
  {
    // Manutenção do sistema, e não uma fase do trabalho na ervateira — por
    // isso fica fora do agrupamento das outras, inclusive para quem a vê.
    secao: 'ADMINISTRAÇÃO',
    itens: [
      { rotulo: 'Usuários', para: '/usuarios', perfis: ['ADMINISTRADOR'], exclusivo: true },
    ],
  },
]

/**
 * Onde cada perfil cai ao entrar.
 *
 * Não é uma permissão: é o lugar onde a pessoa começa o dia. O operador abre o
 * sistema para pesar um caminhão que já está na balança; mandá-lo para um
 * painel de indicadores primeiro custa um clique toda manhã, todo dia.
 *
 * Todos continuam podendo abrir o painel pelo menu.
 */
export const ROTA_INICIAL = {
  OPERADOR_BALANCA: '/pesagem',
  ANALISTA_QUALIDADE: '/avaliacoes',
  COMPRADOR_AVALIADOR: '/campo',
  ADMINISTRATIVO: '/pagamentos',
  ADMINISTRADOR: '/',
}

/**
 * Decide se um item aparece, usando as MESMAS funções que as telas usam.
 *
 * Repare que não há comparação de perfil aqui dentro: `podeFazer` espelha o
 * permitir() e `ehAdministrador` espelha o apenas(). Este arquivo só escolhe
 * qual das duas perguntar, conforme a rota do servidor.
 */
export function itemVisivel(item, { podeFazer, ehAdministrador }) {
  if (item.exclusivo) return ehAdministrador
  if (!item.perfis) return true
  return podeFazer(...item.perfis)
}

/** As seções que sobram para este usuário, já sem as que ficaram vazias. */
export function secoesVisiveis(acesso) {
  return SECOES
    .map((s) => ({ ...s, itens: s.itens.filter((i) => itemVisivel(i, acesso)) }))
    .filter((s) => s.itens.length > 0)
}

/** A tela declarada para um endereço, ou undefined se o endereço não é de tela. */
export function telaDe(para) {
  return SECOES.flatMap((s) => s.itens).find((i) => i.para === para)
}
