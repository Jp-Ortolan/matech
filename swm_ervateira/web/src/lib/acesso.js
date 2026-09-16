export const SECOES = [
  {
    secao: 'OPERAÇÃO',
    itens: [
      { rotulo: 'Pesagem', para: '/pesagem', perfis: null },
      { rotulo: 'Avaliações', para: '/avaliacoes', perfis: ['ANALISTA_QUALIDADE'] },
    ],
  },
  {
    secao: 'CAMPO',
    itens: [
      { rotulo: 'Avaliações de campo', para: '/campo', perfis: ['COMPRADOR_AVALIADOR'] },
    ],
  },
  {
    secao: 'CADASTROS',
    itens: [
      { rotulo: 'Produtores', para: '/produtores', perfis: null },
    ],
  },
  {
    secao: 'FINANCEIRO',
    itens: [
      { rotulo: 'Pagamentos', para: '/pagamentos', perfis: ['ADMINISTRATIVO'] },
    ],
  },
  {
    secao: 'ANÁLISE',
    itens: [
      { rotulo: 'Relatórios', para: '/relatorios', perfis: null },
    ],
  },
  {
    secao: 'ADMINISTRAÇÃO',
    itens: [
      { rotulo: 'Usuários', para: '/usuarios', perfis: ['ADMINISTRADOR'], exclusivo: true },
      { rotulo: 'Registro de alterações', para: '/auditoria', perfis: ['ADMINISTRADOR'], exclusivo: true },
    ],
  },
]

export const ROTA_INICIAL = {
  OPERADOR_BALANCA: '/pesagem',
  ANALISTA_QUALIDADE: '/avaliacoes',
  COMPRADOR_AVALIADOR: '/campo',
  ADMINISTRATIVO: '/pagamentos',
  ADMINISTRADOR: '/pesagem',
}

export function itemVisivel(item, { podeFazer, ehAdministrador }) {
  if (item.exclusivo) return ehAdministrador
  if (!item.perfis) return true
  return podeFazer(...item.perfis)
}

export function secoesVisiveis(acesso) {
  return SECOES
    .map((s) => ({ ...s, itens: s.itens.filter((i) => itemVisivel(i, acesso)) }))
    .filter((s) => s.itens.length > 0)
}

export function telaDe(para) {
  return SECOES.flatMap((s) => s.itens).find((i) => i.para === para)
}
