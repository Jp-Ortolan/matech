// ---------------------------------------------------------------------------
// DOCUMENTOS · validação de CPF e CNPJ
// ---------------------------------------------------------------------------
// VALIDAR NÃO É CONSULTAR, e a diferença aqui é de projeto, não de detalhe.
//
// Não existe API pública legítima que devolva o nome do titular a partir de um
// CPF: isso é dado pessoal protegido pela LGPD, e os serviços que oferecem a
// consulta operam em zona irregular. Então o sistema faz o que é correto e
// suficiente: confere o DÍGITO VERIFICADOR, offline, sem perguntar a ninguém.
//
// O dígito verificador é uma soma ponderada que a Receita embutiu no próprio
// número. Ele não prova que o CPF existe — prova que não foi digitado errado,
// que é justamente o problema real numa balança: o operador troca dois
// algarismos e a ordem de pagamento sai para um documento que não é do
// produtor. A checagem pega isso na hora, e pega 99% das trocas e inversões.
//
// Para CNPJ a história é outra: razão social É pública, e a BrasilAPI a
// devolve de graça. Essa consulta acontece no front, na hora do cadastro —
// ver web/src/lib/consultas.js.
//
// O arquivo vive em lib/ e não dentro de um módulo porque as duas pontas
// precisam dele: a rota de produtores valida ao gravar, e a tela valida
// enquanto se digita. A cópia no front é conveniência; esta aqui é a que vale.

/** Deixa só os dígitos. "123.456.789-09" → "12345678909" */
function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

/**
 * Soma ponderada, o núcleo dos dois algoritmos.
 * Multiplica cada dígito por um peso que decresce, soma, e tira o resto por 11.
 */
function digitoPorPesos(digitos, pesos) {
  const soma = pesos.reduce((total, peso, i) => total + digitos[i] * peso, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

function cpfValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 11) return false

  // 111.111.111-11 e companhia passam na conta dos dígitos, mas não são CPF de
  // ninguém — e são o que sai quando alguém segura uma tecla para "preencher".
  if (d.every((n) => n === d[0])) return false

  const primeiro = digitoPorPesos(d, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = digitoPorPesos(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d[9] === primeiro && d[10] === segundo
}

function cnpjValido(valor) {
  const d = apenasDigitos(valor).split('').map(Number)
  if (d.length !== 14) return false
  if (d.every((n) => n === d[0])) return false

  const primeiro = digitoPorPesos(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = digitoPorPesos(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d[12] === primeiro && d[13] === segundo
}

/** Aceita os dois, decidindo pelo comprimento. */
function documentoValido(valor) {
  const d = apenasDigitos(valor)
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

/**
 * Mensagem de recusa, ou null se estiver bom.
 *
 * Devolve texto e não um booleano porque "documento inválido" não ajuda quem
 * digitou: o operador precisa saber se faltou dígito ou se a conta não fechou.
 */
function erroNoDocumento(valor) {
  const d = apenasDigitos(valor)
  if (!d) return 'Informe o CPF ou CNPJ'
  if (d.length !== 11 && d.length !== 14) {
    return `CPF tem 11 dígitos e CNPJ tem 14 — foram digitados ${d.length}`
  }
  if (!documentoValido(d)) {
    return d.length === 11
      ? 'CPF inválido: confira os números, algum dígito está trocado'
      : 'CNPJ inválido: confira os números, algum dígito está trocado'
  }
  return null
}

/** 12345678909 → "123.456.789-09" · 12345678000199 → "12.345.678/0001-99" */
function formatarDocumento(valor) {
  const d = apenasDigitos(valor)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return valor
}

module.exports = {
  apenasDigitos,
  cpfValido,
  cnpjValido,
  documentoValido,
  erroNoDocumento,
  formatarDocumento,
}
