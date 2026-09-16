import { paraData, chaveDoDia } from './datas.js'

export function plural(n, um, muitos) {
  return Number(n) === 1 ? um : muitos
}

export function contagem(n, um, muitos) {
  return `${formatar.numero(n)} ${plural(n, um, muitos)}`
}

export const formatar = {
  kg: (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`),
  reais: (v) =>
    v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  dataHora: (v) =>
    v == null ? '—' : new Date(v).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }),
  data: (v) => (v == null ? '—' : paraData(v).toLocaleDateString('pt-BR')),
  chaveDoDia,
  materiaPrima: (v) =>
    ({
      ERVA_MATE_NATIVA: 'Erva-mate nativa',
      ERVA_MATE_PLANTADA: 'Erva-mate plantada',
      PALITO: 'Apenas palito',
      LENHA: 'Lenha',
    }[v] || v),

  numero: (v, casas = 0) =>
    v == null ? '—' : Number(v).toLocaleString('pt-BR', {
      minimumFractionDigits: casas, maximumFractionDigits: casas,
    }),
  porcento: (v, casas = 1) =>
    v == null ? '—' : `${Number(v).toFixed(casas).replace('.', ',')}%`,
  precoKg: (v) =>
    v == null ? '—' : `${Number(v).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: 4, maximumFractionDigits: 4,
    })}/kg`,
  precoKgCurto: (v) =>
    v == null ? '—' : `${Number(v).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}/kg`,
  tipoErva: (v) => ({ PLANTADA: 'Plantada', NATIVA: 'Nativa' }[v] || v || '—'),
  formaPagamento: (v) =>
    ({ PIX: 'Pix', CONTA_BANCARIA: 'Conta bancária', DINHEIRO: 'Dinheiro' }[v] || v || '—'),
  tipoConta: (v) => ({ CORRENTE: 'Corrente', POUPANCA: 'Poupança' }[v] || v || '—'),
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
  chavePix: (v) =>
    ({ CPF: 'CPF', TELEFONE: 'Telefone', EMAIL: 'E-mail', ALEATORIA: 'Aleatória' }[v] || v || '—'),
}
