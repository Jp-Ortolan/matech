// Tamanho do texto da web, escolhido em Configurações e guardado no navegador.
// Muda o tamanho base do <html>; como as medidas da tela são em rem,
// letras e espaços crescem juntos.

const CHAVE = 'matech.tamanhoTexto'

export const TAMANHOS = [
  { valor: 'normal', rotulo: 'Normal', escala: '100%' },
  { valor: 'grande', rotulo: 'Grande', escala: '112.5%' },
  { valor: 'muito-grande', rotulo: 'Muito grande', escala: '125%' },
]

export function lerTamanho() {
  try {
    return localStorage.getItem(CHAVE) || 'normal'
  } catch {
    return 'normal'
  }
}

export function aplicarTamanho(valor) {
  const escolhido = TAMANHOS.find((t) => t.valor === valor) || TAMANHOS[0]
  document.documentElement.style.setProperty('--tamanho-texto', escolhido.escala)
  try {
    localStorage.setItem(CHAVE, escolhido.valor)
  } catch {
    // navegador sem armazenamento: vale só nesta aba
  }
  return escolhido.valor
}
