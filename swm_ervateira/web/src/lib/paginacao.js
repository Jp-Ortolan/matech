// ---------------------------------------------------------------------------
// PAGINAÇÃO · quais números de página mostrar
// ---------------------------------------------------------------------------
// Com trinta páginas, desenhar as trinta ocuparia mais espaço que a tabela.
// Mostra-se a primeira, a última e as vizinhas da atual — que é para onde o
// dedo vai — e o resto vira reticências.
//
// Está fora do componente para poder ser testada: é lógica de índice, e lógica
// de índice erra na borda (primeira página, última, e o momento em que as
// reticências deveriam ser um número só).

/**
 * faixaDePaginas(4, 12) → [1, null, 3, 4, 5, null, 12]
 *
 * `null` é o lugar das reticências.
 */
export function faixaDePaginas(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const perto = [atual - 1, atual, atual + 1].filter((n) => n > 1 && n < total)
  const numeros = [1, ...perto, total]

  const comVaos = []
  let anterior = 0
  for (const n of numeros) {
    // Reticências só quando há mais de um número escondido. Trocar um único
    // número por "…" gasta o mesmo espaço e esconde uma página alcançável.
    if (n - anterior > 1) comVaos.push(null)
    comVaos.push(n)
    anterior = n
  }
  return comVaos
}
