const LIMITES = {
  nome: 120,
  telefone: 20,
  endereco: 160,
  bairro: 60,
  municipio: 60,
  chavePix: 77,
  titularConta: 120,
  banco: 60,
  agencia: 10,
  conta: 20,
  identificacao: 80,   // erval
  observacoes: 1000,   // avaliação e carga
  motivo: 300,         // justificativas e motivos de reprovação
  taloAparente: 60,
  tipo: 40,            // tipo do veículo
  cnhCategoria: 3,
}

const ROTULOS = {
  nome: 'o nome',
  telefone: 'o telefone',
  endereco: 'o endereço',
  bairro: 'o bairro',
  municipio: 'o município',
  chavePix: 'a chave Pix',
  titularConta: 'o titular da conta',
  banco: 'o banco',
  agencia: 'a agência',
  conta: 'a conta',
  identificacao: 'a identificação',
  observacoes: 'as observações',
  motivo: 'o motivo',
  taloAparente: 'o talo aparente',
  tipo: 'o tipo do veículo',
  cnhCategoria: 'a categoria da CNH',
}

// Campos de texto livre que precisam ter conteúdo de verdade.
// Telefone, conta, agência e chave Pix ficam de fora: repetir dígito ali é normal.
const TEXTOS_LIVRES = [
  'nome', 'titularConta', 'endereco', 'bairro', 'municipio', 'banco',
  'identificacao', 'observacoes', 'motivo', 'taloAparente', 'tipo',
]

// Nomes de pessoa precisam de pelo menos 3 letras.
const NOMES = ['nome', 'titularConta']

const LETRA_REPETIDA = /(\p{L})\1{4,}/iu   // mesma letra 5 vezes seguidas
const PALAVRA_GIGANTE = /\S{41,}/           // nenhuma palavra real passa de 40 letras
const LETRA = /\p{L}/gu

function erroDeTamanho(dados = {}) {
  for (const [campo, limite] of Object.entries(LIMITES)) {
    const valor = dados[campo]
    if (valor === undefined || valor === null) continue
    if (String(valor).length > limite) {
      const rotulo = ROTULOS[campo] || campo
      return `Reduza ${rotulo}: o limite é ${limite} caracteres`
    }
  }
  return null
}

// Campos onde palavra de teste ou sequência de teclado não faz sentido.
// Observações e motivos ficam de fora: "teste de umidade" é texto normal ali.
const TEXTOS_COM_SENTIDO = [
  'nome', 'titularConta', 'endereco', 'bairro', 'municipio', 'banco', 'identificacao',
]

// Palavras que aparecem quando alguém digita qualquer coisa só para passar.
const PALAVRAS_DE_TESTE = new Set([
  'teste', 'testes', 'test', 'testando', 'asdf', 'asdfg', 'asdfgh', 'qwe', 'qwer', 'qwert', 'qwerty',
  'abc', 'abcd', 'abcde', 'xxx', 'xxxx', 'xpto', 'fulano', 'ciclano', 'sicrano', 'beltrano',
  'nome', 'sobrenome', 'lorem', 'ipsum', 'aaa', 'zzz', 'blabla', 'nada', 'ninguem',
])

// Pedaços de linhas do teclado, como "asdf" ou "qwer".
const LINHAS_DO_TECLADO = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm']
const SEQUENCIA_DE_TECLADO = []
for (const linha of LINHAS_DO_TECLADO) {
  for (let i = 0; i + 4 <= linha.length; i++) SEQUENCIA_DE_TECLADO.push(linha.slice(i, i + 4))
}

const VOGAL = /[aeiouyáàâãéêíóôõúü]/i

function semAcento(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function palavrasDe(texto) {
  return texto.split(/[\s.,;:/()\-]+/).filter(Boolean)
}

// Regras extras para nome de pessoa ou empresa.
function erroNoNome(texto, rotulo) {
  const palavras = palavrasDe(texto).filter((p) => (p.match(LETRA) || []).length > 0)
  const comDuasLetras = palavras.filter((p) => (p.match(LETRA) || []).length >= 2)
  if (comDuasLetras.length < 2) {
    return `Confira ${rotulo}: informe o nome completo, com pelo menos nome e sobrenome`
  }
  for (const p of palavras) {
    const letras = (p.match(LETRA) || []).length
    const sigla = p === p.toUpperCase() && letras <= 4   // LTDA, ME, JBS...
    if (letras >= 3 && !sigla && !VOGAL.test(p)) {
      return `Confira ${rotulo}: "${p}" não parece uma palavra`
    }
  }
  return null
}

function erroDeTeste(texto, rotulo) {
  const limpo = semAcento(texto)
  for (const p of palavrasDe(limpo)) {
    if (PALAVRAS_DE_TESTE.has(p)) return `Confira ${rotulo}: "${p}" parece um texto de teste`
  }
  for (const p of palavrasDe(limpo)) {
    const seq = SEQUENCIA_DE_TECLADO.find((s) => p.includes(s))
    if (seq) return `Confira ${rotulo}: parece uma sequência do teclado ("${seq}")`
  }
  return null
}

// Recusa texto sem sentido, como "aaaaaAAAA", "asdfgh", "teste" ou uma palavra de 80 letras.
function erroDeConteudo(dados = {}) {
  for (const campo of TEXTOS_LIVRES) {
    const valor = dados[campo]
    if (valor === undefined || valor === null || valor === '') continue
    const texto = String(valor).trim()
    const rotulo = ROTULOS[campo] || campo

    if (NOMES.includes(campo) && (texto.match(LETRA) || []).length < 3) {
      return `Confira ${rotulo}: precisa ter pelo menos 3 letras`
    }
    if (LETRA_REPETIDA.test(texto)) {
      return `Confira ${rotulo}: há uma letra repetida muitas vezes seguidas`
    }
    if (PALAVRA_GIGANTE.test(texto)) {
      return `Confira ${rotulo}: há uma palavra com mais de 40 letras, sem espaço`
    }
    if (TEXTOS_COM_SENTIDO.includes(campo)) {
      const erro = erroDeTeste(texto, rotulo)
      if (erro) return erro
    }
    if (NOMES.includes(campo)) {
      const erro = erroNoNome(texto, rotulo)
      if (erro) return erro
    }
  }
  return null
}

// Tamanho e conteúdo juntos: é o que as rotas chamam.
function erroNosTextos(dados = {}) {
  return erroDeTamanho(dados) || erroDeConteudo(dados)
}

module.exports = { LIMITES, erroDeTamanho, erroDeConteudo, erroNosTextos }
