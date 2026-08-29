// ---------------------------------------------------------------------------
// DATAS · leitura no fuso de quem está olhando
// ---------------------------------------------------------------------------
// Duas funções pequenas que existem por causa da mesma armadilha do
// JavaScript, e que custaram um dia inteiro nos relatórios.
//
// `new Date('2026-08-11')` NÃO é 11 de agosto aqui. É meia-noite em UTC, que
// no horário de Brasília (UTC−3) é o dia 10 às 21h. E `toISOString()` faz o
// caminho contrário: uma carga pesada às 21h30 de 11/08 vira 12/08.
//
// Estão neste arquivo, separadas da camada visual, para poderem ser testadas.

/**
 * Interpreta uma data no fuso local.
 *
 * Strings "AAAA-MM-DD", sem hora, são construídas campo a campo — é o único
 * jeito de o JavaScript entendê-las como o dia local em vez de meia-noite em
 * UTC. É o formato que vem dos filtros `<input type="date">` e das chaves de
 * agrupamento por dia.
 *
 * Qualquer outro valor (ISO com hora, Date, número) segue o caminho normal:
 * data com hora vem do servidor em UTC e deve mesmo ser convertida.
 */
export function paraData(v) {
  if (typeof v === 'string') {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (partes) return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  }
  return new Date(v)
}

/**
 * Chave de agrupamento por dia, no fuso local: "2026-08-11".
 *
 * Quem opera a balança conta o dia dele, não o de Greenwich. Uma carga das
 * 21h30 pertence ao dia em que o caminhão chegou.
 */
export function chaveDoDia(v) {
  const d = new Date(v)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
