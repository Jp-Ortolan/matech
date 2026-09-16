function celula(valor) {
  if (valor === null || valor === undefined) return '""'
  const texto = String(valor).replace(/"/g, '""')
  return `"${texto}"`
}

export function baixarCsv(nomeArquivo, cabecalho, linhas) {
  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(celula).join(';'))
    .join('\r\n')

  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

export function numeroCsv(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === '') return ''
  return Number(valor).toFixed(casas).replace('.', ',')
}
