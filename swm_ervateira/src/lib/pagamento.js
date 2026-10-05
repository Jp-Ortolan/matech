const { ErroDeNegocio } = require('../middlewares/erros')

// Confere os campos da forma de pagamento escolhida e limpa os das outras.
// Usado pela web (rota de produtores) e pelo app (sincronização).
function ajustarPagamento(dados) {
  const forma = dados.formaPagamento
  if (!forma) return dados

  if (forma === 'PIX') {
    if (!dados.chavePix) {
      throw new ErroDeNegocio('Informe a chave Pix para quem recebe por Pix', 400)
    }
    if (!dados.tipoChavePix) {
      throw new ErroDeNegocio('Informe o tipo da chave Pix', 400)
    }
    Object.assign(dados, { banco: null, agencia: null, conta: null, tipoConta: null })
  }

  if (forma === 'CONTA_BANCARIA') {
    for (const [campo, rotulo] of [['banco', 'o banco'], ['agencia', 'a agência'], ['conta', 'a conta']]) {
      if (!dados[campo]) throw new ErroDeNegocio(`Informe ${rotulo}`, 400)
    }
    if (!dados.tipoConta) {
      throw new ErroDeNegocio('Informe se a conta é corrente ou poupança', 400)
    }
    Object.assign(dados, { tipoChavePix: null, chavePix: null })
  }

  if (forma === 'DINHEIRO') {
    Object.assign(dados, {
      tipoChavePix: null, chavePix: null,
      banco: null, agencia: null, conta: null, tipoConta: null,
    })
  }

  return dados
}

module.exports = { ajustarPagamento }
