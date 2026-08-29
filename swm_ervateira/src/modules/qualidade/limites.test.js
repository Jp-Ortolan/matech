// ---------------------------------------------------------------------------
// TESTES · o que reprova uma carga
// ---------------------------------------------------------------------------
// É a regra que decide se um produtor recebe pelo caminhão que entregou.
// Tem teste sem banco porque é pura de propósito.

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { conferirLimites, motivosDaAnalise, exigeJustificativa } = require('./limites')

const REGUA = { palitoMaximo: 45, umidadeMaxima: 45, folhaMinima: 60 }

describe('conferirLimites', () => {
  test('amostra dentro de tudo não gera motivo nenhum', () => {
    const m = conferirLimites({ palitoPercentual: 34, umidadePercentual: 41, folhaPercentual: 66 }, REGUA)
    assert.equal(m.length, 0)
  })

  test('palito acima do máximo reprova, e diz o número', () => {
    const [m] = conferirLimites({ palitoPercentual: 47 }, REGUA)
    assert.equal(m.campo, 'palito')
    assert.equal(m.medido, 47)
    assert.equal(m.limite, 45)
    assert.equal(m.texto, 'Palito de 47,0%, acima do máximo de 45,0%.')
  })

  test('folha é o critério invertido: menos é pior', () => {
    assert.equal(conferirLimites({ folhaPercentual: 52 }, REGUA)[0].campo, 'folha')
    assert.equal(conferirLimites({ folhaPercentual: 66 }, REGUA).length, 0)
  })

  test('exatamente no limite NÃO reprova', () => {
    // O limite é o que se aceita, não o primeiro valor recusado. Um ponto de
    // diferença aqui é uma carga inteira devolvida.
    assert.equal(conferirLimites({ palitoPercentual: 45 }, REGUA).length, 0)
    assert.equal(conferirLimites({ umidadePercentual: 45 }, REGUA).length, 0)
    assert.equal(conferirLimites({ folhaPercentual: 60 }, REGUA).length, 0)
  })

  test('dois critérios errados devolvem dois motivos', () => {
    const m = conferirLimites({ palitoPercentual: 47, folhaPercentual: 52 }, REGUA)
    assert.equal(m.length, 2)
    assert.deepEqual(m.map((x) => x.campo), ['palito', 'folha'])
  })

  test('LIMITE NULO É AUSÊNCIA DE REGRA, e não zero', () => {
    // A ervateira que não reprova por umidade deixa o campo em branco. Se isto
    // quebrar, um campo vazio passa a reprovar todas as cargas do sistema.
    const semRegua = { palitoMaximo: null, umidadeMaxima: null, folhaMinima: null }
    const m = conferirLimites({ palitoPercentual: 99, umidadePercentual: 99, folhaPercentual: 0 }, semRegua)
    assert.equal(m.length, 0)
  })

  test('medida não informada não reprova', () => {
    // Umidade é campo opcional na análise. Não medir não é reprovar.
    assert.equal(conferirLimites({ palitoPercentual: 34 }, REGUA).length, 0)
  })

  test('régua ausente por inteiro não quebra', () => {
    assert.equal(conferirLimites({ palitoPercentual: 99 }, undefined).length, 0)
    assert.equal(conferirLimites(undefined, REGUA).length, 0)
  })
})

describe('motivosDaAnalise', () => {
  test('usa os limites gravados na análise, não os de hoje', () => {
    // O ponto inteiro de copiar os limites para dentro da análise: o laudo
    // antigo continua dizendo o que dizia depois de a ervateira mudar a régua.
    const analiseAntiga = {
      palitoPercentual: 47, palitoMaximo: 50,   // na época, 47 passava
      umidadePercentual: null, folhaPercentual: null,
    }
    assert.deepEqual(motivosDaAnalise(analiseAntiga), [])
  })

  test('junta o limite estourado e o motivo escrito', () => {
    const m = motivosDaAnalise({
      palitoPercentual: 47, palitoMaximo: 45,
      motivoReprovacao: 'Amostra com cheiro de mofo.',
    })
    assert.equal(m.length, 2)
    assert.match(m[0], /Palito de 47,0%/)
    assert.equal(m[1], 'Amostra com cheiro de mofo.')
  })

  test('reprovação só por texto do analista aparece sozinha', () => {
    assert.deepEqual(
      motivosDaAnalise({ palitoPercentual: 20, motivoReprovacao: 'Carga molhada na viagem.' }),
      ['Carga molhada na viagem.']
    )
  })

  test('sem análise, sem motivo', () => {
    assert.deepEqual(motivosDaAnalise(null), [])
  })
})

describe('exigeJustificativa', () => {
  test('reprovar sem limite estourado exige explicação', () => {
    assert.ok(exigeJustificativa({ aprovada: false, limitesEstourados: [] }))
  })

  test('aprovar COM limite estourado também exige', () => {
    // Os dois sentidos, pelo mesmo motivo: sempre que a pessoa contraria a
    // régua, o porquê fica escrito.
    assert.ok(exigeJustificativa({ aprovada: true, limitesEstourados: [{ campo: 'palito' }] }))
  })

  test('decisão que concorda com a régua não exige nada', () => {
    assert.equal(exigeJustificativa({ aprovada: true, limitesEstourados: [] }), null)
    assert.equal(exigeJustificativa({ aprovada: false, limitesEstourados: [{ campo: 'palito' }] }), null)
  })
})
