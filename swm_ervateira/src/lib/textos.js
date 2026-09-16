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
}

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

module.exports = { LIMITES, erroDeTamanho }
