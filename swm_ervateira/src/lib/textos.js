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

// Recusa texto sem sentido, como "aaaaaAAAA" ou uma palavra de 80 letras.
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
  }
  return null
}

// Tamanho e conteúdo juntos: é o que as rotas chamam.
function erroNosTextos(dados = {}) {
  return erroDeTamanho(dados) || erroDeConteudo(dados)
}

module.exports = { LIMITES, erroDeTamanho, erroDeConteudo, erroNosTextos }
