// ---------------------------------------------------------------------------
// TESTE UNITÁRIO · o tipo da imagem vem dos bytes
// ---------------------------------------------------------------------------
// O teste que dá sentido a este arquivo é o penúltimo: um HTML anunciado como
// image/jpeg. Era o que o servidor gravava antes, porque acreditava no
// cabeçalho — e gravava dentro de uma pasta servida estaticamente, na mesma
// origem da API.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { tipoDaImagem, EXTENSOES } = require('./imagens')

/// Cabeçalho verdadeiro + enchimento. O conteúdo depois da assinatura não
/// importa para esta checagem, e é por isso que ela é barata.
const comCabecalho = (bytes) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(32)])

describe('reconhece os formatos que aceitamos', () => {
  test('JPEG', () => {
    assert.equal(tipoDaImagem(comCabecalho([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  })

  test('PNG', () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    assert.equal(tipoDaImagem(comCabecalho(png)), 'image/png')
  })

  test('WebP — o formato que a câmera do Android produz por padrão', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x20, 0x00, 0x00, 0x00]), // tamanho, irrelevante aqui
      Buffer.from('WEBP'),
      Buffer.alloc(32),
    ])
    assert.equal(tipoDaImagem(webp), 'image/webp')
  })
})

describe('recusa o que não é imagem', () => {
  test('HTML — é ESTE o caso que motivou a checagem', () => {
    // Antes bastava mandar isto com Content-Type: image/jpeg. O arquivo era
    // gravado como .jpg em uploads/fotos/ e servido pela mesma origem da API.
    const html = Buffer.from('<html><script>alert(document.cookie)</script></html>')
    assert.equal(tipoDaImagem(html), null)
  })

  test('arquivo curto demais para ter assinatura', () => {
    assert.equal(tipoDaImagem(Buffer.from([0xff, 0xd8, 0xff])), null)
  })

  test('RIFF que não é WebP (um WAV, por exemplo)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVE'),
      Buffer.alloc(32),
    ])
    assert.equal(tipoDaImagem(wav), null)
  })

  test('corpo vazio e valor que nem é Buffer', () => {
    assert.equal(tipoDaImagem(Buffer.alloc(0)), null)
    assert.equal(tipoDaImagem(null), null)
    assert.equal(tipoDaImagem('image/jpeg'), null)
  })
})

test('todo tipo reconhecido tem extensão — senão a rota grava sem sufixo', () => {
  for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.ok(EXTENSOES[tipo], `faltou extensão para ${tipo}`)
  }
})
