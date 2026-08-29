// ---------------------------------------------------------------------------
// FORMATAÇÃO · como cada valor vira texto na tela
// ---------------------------------------------------------------------------
// UM módulo só, e não um pedaço aqui e uma gambiarra ali. Antes isto morava
// dentro de componentes/ui.jsx, junto dos botões e das tabelas — o que fazia
// qualquer arquivo que precisasse formatar um número importar a biblioteca de
// interface inteira, inclusive o back-end de teste.
//
// A regra do arquivo: entra `null` ou `undefined`, sai "—". Nunca "NaN",
// nunca "R$ null", nunca vazio. Uma célula vazia numa tabela de operação é
// ambígua — pode ser zero, pode ser falta de dado, pode ser bug. O travessão
// diz "não há", e diz sempre igual.

import { paraData, chaveDoDia } from './datas.js'

/**
 * Concordância de número: plural(1, 'carga', 'cargas') → 'carga'.
 *
 * Existia espalhado em dezoito lugares, sempre como `n === 1 ? 'x' : 'xs'`.
 * Aceita frase inteira, e não só substantivo, porque em português o verbo
 * acompanha: plural(n, 'amostra aguarda', 'amostras aguardam').
 */
export function plural(n, um, muitos) {
  return Number(n) === 1 ? um : muitos
}

/**
 * O número junto da palavra: contagem(3, 'carga', 'cargas') → "3 cargas".
 *
 * É a forma que aparece em quase toda a interface, e o número passa pelo
 * separador de milhar de propósito — "1.204 cargas", e não "1204 cargas".
 */
export function contagem(n, um, muitos) {
  return `${formatar.numero(n)} ${plural(n, um, muitos)}`
}

export const formatar = {
  /** 7240 → "7.240 kg" */
  kg: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`),
  /** 33709.44 → "R$ 33.709,44" */
  reais: (v) =>
    v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  /** data ISO → "12/08 13:12" */
  dataHora: (v) =>
    v == null ? '—' : new Date(v).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }),
  /** data → "11/08/2026" — lida no fuso local; a armadilha está em lib/datas.js */
  data: (v) => (v == null ? '—' : paraData(v).toLocaleDateString('pt-BR')),
  /** data → "2026-08-11" — chave de agrupamento por dia, no fuso local */
  chaveDoDia,
  /** ERVA_MATE_NATIVA → "Erva-mate nativa" */
  materiaPrima: (v) =>
    ({
      ERVA_MATE_NATIVA: 'Erva-mate nativa',
      ERVA_MATE_PLANTADA: 'Erva-mate plantada',
      PALITO: 'Apenas palito',
      LENHA: 'Lenha',
    }[v] || v),

  // ---- acrescentados junto com as telas de preços e relatórios ----

  /** 12345.6 → "12.346"  ·  (12345.6, 2) → "12.345,60" */
  numero: (v, casas = 0) =>
    v == null ? '—' : Number(v).toLocaleString('pt-BR', {
      minimumFractionDigits: casas, maximumFractionDigits: casas,
    }),
  /** 4.2 → "4,2%" — o percentual aparece o tempo todo nos relatórios */
  porcento: (v, casas = 1) =>
    v == null ? '—' : `${Number(v).toFixed(casas).replace('.', ',')}%`,
  /** 4.656 → "R$ 4,6560/kg" — preço por quilo tem quatro casas no banco */
  precoKg: (v) =>
    v == null ? '—' : `${Number(v).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: 4, maximumFractionDigits: 4,
    })}/kg`,
  /** NATIVA → "Nativa" */
  tipoErva: (v) => ({ PLANTADA: 'Plantada', NATIVA: 'Nativa' }[v] || v || '—'),
  /** PIX → "Pix"  ·  CONTA_BANCARIA → "Conta bancária" */
  formaPagamento: (v) =>
    ({ PIX: 'Pix', CONTA_BANCARIA: 'Conta bancária', DINHEIRO: 'Dinheiro' }[v] || v || '—'),
  tipoConta: (v) => ({ CORRENTE: 'Corrente', POUPANCA: 'Poupança' }[v] || v || '—'),
  /** 52998224725 → "529.982.247-25" · 11222333000181 → "11.222.333/0001-81" */
  documento: (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    return v || '—'
  },
  cep: (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : v || '—'
  },
  /** ALEATORIA → "Aleatória" */
  chavePix: (v) =>
    ({ CPF: 'CPF', TELEFONE: 'Telefone', EMAIL: 'E-mail', ALEATORIA: 'Aleatória' }[v] || v || '—'),
}
