// ---------------------------------------------------------------------------
// TEXTOS · limites de tamanho dos campos cadastrais
// ---------------------------------------------------------------------------
// POR QUE ISTO EXISTE, se o banco aceita texto de qualquer tamanho.
//
// É exatamente por isso. As colunas do Produtor são `text` no PostgreSQL, sem
// teto: um corpo de requisição com um nome de dois megabytes é gravado sem
// reclamar. Ninguém digita isso numa tela — mas a tela não é a única porta.
// A API aceita JSON de quem tiver um token válido, e o aplicativo em campo
// envia lotes. Um campo sem teto é espaço de armazenamento de graça para quem
// quiser usá-lo para outra coisa, e é uma tela de listagem quebrada para todo
// mundo depois.
//
// O limite fica AQUI, num lugar só, porque três caminhos gravam produtor: a
// tela web (POST/PUT /api/produtores), o aplicativo (POST /api/sincronizacao)
// e, um dia, o que vier depois. Repetir o número em cada um seria garantir que
// eles divergissem.
//
// RECUSAR, E NÃO CORTAR. Cortar em silêncio grava "José da Silva Sant" no
// lugar de "José da Silva Santana" e ninguém fica sabendo até a ordem de
// pagamento sair com o nome errado. Recusar devolve o erro para quem ainda
// está com o teclado na mão.

/// Os tetos. Generosos de propósito: são um teto de sanidade, não uma regra
/// de negócio. Nenhum deles deve incomodar um cadastro real.
///
/// A chave Pix é a única com número justificado de fora: 77 é o máximo que a
/// especificação do Banco Central admite (o caso do e-mail; a chave aleatória
/// tem 36 e o telefone, 14).
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

/// Nome amigável para a mensagem de erro. Sem isto o produtor recebe
/// "chavePix é longo demais", que é o nome da coluna, não o rótulo da tela.
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

/**
 * Devolve a mensagem de erro do primeiro campo longo demais, ou null.
 *
 * Só olha o que está no objeto: um PUT que manda três campos não é julgado
 * pelos treze que não mandou.
 */
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
