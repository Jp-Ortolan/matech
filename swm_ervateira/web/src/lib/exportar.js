// ---------------------------------------------------------------------------
// EXPORTAÇÃO CSV · gerada no navegador, sem passar pelo servidor
// ---------------------------------------------------------------------------
// O relatório já está montado na tela, com os mesmos números que o usuário
// está vendo. Pedir ao servidor para montá-lo de novo criaria uma segunda
// versão da mesma conta — e duas contas separadas divergem cedo ou tarde.
//
// Detalhes que fazem o arquivo abrir certo no Excel em português:
//   · separador ponto e vírgula, porque a vírgula já é o separador decimal
//   · BOM no começo, senão acentos viram caracteres estranhos
//   · valores entre aspas, com aspas internas dobradas

function celula(valor) {
  if (valor === null || valor === undefined) return '""'
  const texto = String(valor).replace(/"/g, '""')
  return `"${texto}"`
}

/**
 * Monta e baixa o arquivo.
 * @param {string} nomeArquivo  sem extensão
 * @param {string[]} cabecalho  títulos das colunas
 * @param {Array[]} linhas      matriz de valores, na mesma ordem do cabeçalho
 */
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

  // Sem isto o navegador segura o arquivo na memória até fechar a aba.
  URL.revokeObjectURL(url)
}

/** Número no formato que o Excel em português entende: vírgula decimal. */
export function numeroCsv(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === '') return ''
  return Number(valor).toFixed(casas).replace('.', ',')
}
