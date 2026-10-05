const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { ajustarPagamento } = require('./pagamento')

describe('ajustarPagamento', () => {
  test('Pix sem chave é recusado', () => {
    assert.throws(() => ajustarPagamento({ formaPagamento: 'PIX', tipoChavePix: 'CPF' }), /chave Pix/)
  })

  test('Pix limpa os dados de conta', () => {
    const d = ajustarPagamento({ formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: '123', banco: 'X' })
    assert.equal(d.banco, null)
    assert.equal(d.chavePix, '123')
  })

  test('conta bancária exige banco, agência, conta e tipo', () => {
    assert.throws(() => ajustarPagamento({ formaPagamento: 'CONTA_BANCARIA', banco: 'Sicredi', agencia: '0101' }), /conta/)
    assert.throws(() => ajustarPagamento({ formaPagamento: 'CONTA_BANCARIA', banco: 'Sicredi', agencia: '0101', conta: '123' }), /corrente ou poupança/)
  })

  test('conta bancária limpa a chave Pix', () => {
    const d = ajustarPagamento({
      formaPagamento: 'CONTA_BANCARIA', banco: 'Sicredi', agencia: '0101', conta: '123', tipoConta: 'CORRENTE', chavePix: 'x',
    })
    assert.equal(d.chavePix, null)
    assert.equal(d.conta, '123')
  })

  test('dinheiro não guarda destino bancário', () => {
    const d = ajustarPagamento({ formaPagamento: 'DINHEIRO', chavePix: 'x', banco: 'y' })
    assert.equal(d.chavePix, null)
    assert.equal(d.banco, null)
  })
})
