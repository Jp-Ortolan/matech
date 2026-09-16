export function faixaDePaginas(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const perto = [atual - 1, atual, atual + 1].filter((n) => n > 1 && n < total)
  const numeros = [1, ...perto, total]

  const comVaos = []
  let anterior = 0
  for (const n of numeros) {
    if (n - anterior > 1) comVaos.push(null)
    comVaos.push(n)
    anterior = n
  }
  return comVaos
}
