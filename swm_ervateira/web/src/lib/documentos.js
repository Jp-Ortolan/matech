// ---------------------------------------------------------------------------
// DOCUMENTOS · validação e máscara, no navegador
// ---------------------------------------------------------------------------
// Cópia deliberada do src/lib/documentos.js do servidor, pelo mesmo motivo do
// cálculo de pagamento: a tela avisa CEDO, o servidor GARANTE. Aqui o operador
// vê o erro enquanto ainda está com o produtor na frente; lá, nenhum cliente é
// confiável — nem esta tela, nem o aplicativo móvel, nem o próximo que vier.
//
// A duplicação é pequena e estável (o algoritmo do dígito verificador não muda
// desde 1970). Compartilhar o arquivo entre os dois exigiria um pacote comum e
// uma etapa de build só para isso, que não se paga num sistema deste tamanho.

const apenasDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')

function digitoPorPesos(digitos, pesos) {
  const soma = pesos.reduce((total, peso, i) => total + digitos[i] * peso, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cpfValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 11 || d.every((n) => n === d[0])) return false
  return (
    d[9] === digitoPorPesos(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    d[10] === digitoPorPesos(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  )
}

export function cnpjValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 14 || d.every((n) => n === d[0])) return false
  return (
    d[12] === digitoPorPesos(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    d[13] === digitoPorPesos(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  )
}

/** Mensagem de recusa, ou null. Texto e não booleano: "inválido" não conserta nada. */
export function erroNoDocumento(valor) {
  const d = apenasDigitos(valor)
  if (!d) return 'Informe o CPF ou CNPJ'
  if (d.length !== 11 && d.length !== 14) {
    return `CPF tem 11 dígitos e CNPJ tem 14 — foram digitados ${d.length}`
  }
  const ok = d.length === 11 ? cpfValido(d) : cnpjValido(d)
  if (!ok) {
    return d.length === 11
      ? 'CPF inválido: confira, algum dígito está trocado'
      : 'CNPJ inválido: confira, algum dígito está trocado'
  }
  return null
}

export function erroNoCpf(valor) {
  const d = apenasDigitos(valor)
  if (!d) return 'Informe o CPF'
  if (d.length !== 11) return `CPF tem 11 dígitos — foram digitados ${d.length}`
  return cpfValido(d) ? null : 'CPF inválido: confira, algum dígito está trocado'
}

// ---------------------------------------------------------------------------
// MÁSCARAS
// ---------------------------------------------------------------------------
// Aplicadas enquanto se digita, e SEMPRE removidas antes de enviar. O banco
// guarda só dígitos — a pontuação é da tela, não do dado.

export function mascararDocumento(valor) {
  const d = apenasDigitos(valor).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function mascararCep(valor) {
  return apenasDigitos(valor).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

export function mascararTelefone(valor) {
  const d = apenasDigitos(valor).slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

/** ABC1D23 — sem hífen, que o Mercosul não usa. */
export function mascararPlaca(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

export const PLACA_VALIDA = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/

export function erroNaPlaca(valor) {
  const p = mascararPlaca(valor)
  if (!p) return null // placa é opcional
  return PLACA_VALIDA.test(p) ? null : 'Placa inválida. Use ABC1234 ou ABC1D23'
}

export { apenasDigitos }
