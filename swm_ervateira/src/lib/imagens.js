// ---------------------------------------------------------------------------
// IMAGENS · o tipo do arquivo vem dos BYTES, nunca do cabeçalho
// ---------------------------------------------------------------------------
// O upload de foto confiava no Content-Type que o cliente mandava. Isso é
// confiar no remetente para dizer o que está no envelope.
//
// O que dava errado, na ordem em que dá:
//
//   1. Quem envia escolhe o cabeçalho. Um script pode mandar `image/jpeg` com
//      um HTML dentro. O arquivo é gravado em uploads/fotos/, e uploads/ é
//      servido estaticamente — a mesma origem da API. HTML servido dali roda
//      com os cookies do domínio.
//   2. Mesmo sem má intenção, um cliente mal configurado grava um arquivo que
//      não abre. O erro só aparece meses depois, quando alguém tenta ver a
//      foto da avaliação que justificava um desconto.
//
// A checagem é barata: os primeiros bytes de JPEG, PNG e WebP são constantes
// definidas nos formatos. Ler doze bytes responde a pergunta.
//
// NÃO é antivírus e não pretende ser. É a diferença entre "o cliente disse
// que é uma imagem" e "começa como uma imagem começa" — que é o que impede o
// arquivo de ser servido como outra coisa.

/**
 * Devolve o tipo real do buffer, ou null se não for imagem que aceitamos.
 * Os três formatos são os mesmos que o express.raw() da rota admite.
 */
function tipoDaImagem(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null

  // JPEG: todo arquivo começa com o marcador SOI (FFD8) seguido de outro
  // marcador, que sempre abre com FF.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: assinatura de 8 bytes fixada na especificação. Os quatro primeiros
  // depois do 0x89 são as letras "PNG"; o resto detecta transferência que
  // estragou quebras de linha.
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }

  // WebP é um contêiner RIFF: "RIFF", quatro bytes de tamanho, e "WEBP".
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

/// A extensão sai do tipo REAL, e não do cabeçalho. É por isso que o mapa
/// mora aqui e não na rota: quem decide o nome do arquivo é quem leu os bytes.
const EXTENSOES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

module.exports = { tipoDaImagem, EXTENSOES }
