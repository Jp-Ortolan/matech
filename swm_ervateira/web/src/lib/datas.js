export function paraData(v) {
  if (typeof v === 'string') {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (partes) return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  }
  return new Date(v)
}

export function chaveDoDia(v) {
  const d = new Date(v)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
