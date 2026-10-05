// Municípios do IBGE por UF, embutidos no sistema (lib/municipios.json).
// O arquivo só é carregado quando um formulário pede, e não depende de internet.

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

let tabela = null

export async function municipiosDa(uf) {
  if (!uf) return []
  tabela ??= (await import('./municipios.json')).default
  return tabela[uf] ?? []
}
