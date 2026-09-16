export function resumirFiltros(valores, descrever) {
  return Object.entries(valores ?? {})
    .filter(([chave, v]) => v !== '' && v != null && typeof descrever[chave] === 'function')
    .map(([chave, v]) => ({ chave, texto: descrever[chave](v) }))
    .filter((f) => f.texto)
}

export function nomeNaLista(lista, id, campo = 'nome') {
  return lista?.find((x) => x.id === id)?.[campo] ?? 'selecionado'
}
