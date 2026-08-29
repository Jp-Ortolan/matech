// ---------------------------------------------------------------------------
// SIGILO · o que sai do servidor, e para quem
// ---------------------------------------------------------------------------
// CPF e chave Pix de produtor são dado pessoal. A LGPD trata os dois como
// identificadores, e a chave Pix costuma SER o CPF — mascarar um e deixar o
// outro passar não protegeria nada.
//
// A DECISÃO QUE IMPORTA: o mascaramento acontece AQUI, no servidor, e não na
// tela. Escondido no front, o número continua viajando pela rede e aparece
// inteiro em qualquer inspetor de navegador — a proteção seria só visual, e
// visual é o mesmo que nenhuma. Quem não pode ver, não recebe.
//
// Quem PODE ver pede explicitamente, em GET /api/produtores/:id/sigilosos.
// Duas consequências que valem a pena: o dado só trafega quando alguém precisa
// dele de fato, e o pedido é atribuível a um usuário, porque passa pelo token.
//
// O CPF do produtor também sai do ticket impresso. Aquele papel vai para a mão
// do motorista, que é um terceiro — é o único ponto do sistema em que o dado
// pessoal deixa a empresa em suporte físico, e não havia motivo para estar lá:
// o ticket identifica a carga, não o titular do pagamento.

// CPF 12345678901 vira "123.***.***-01"; o CNPJ mantém só os dois primeiros
// dígitos e os dois do verificador.
function mascararDocumento(valor) {
  const d = String(valor ?? '').replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`
  // Documento fora do padrão: esconde tudo menos os dois últimos, porque não
  // dá para saber quais partes são identificadoras.
  return d.length > 2 ? `${'*'.repeat(d.length - 2)}${d.slice(-2)}` : '***'
}

/**
 * Máscara da chave Pix, que muda de forma conforme o tipo.
 *
 * E-mail preserva o domínio: quem confere um pagamento precisa reconhecer a
 * chave, não decorá-la. "jo***@gmail.com" basta para saber que é a certa e não
 * basta para usá-la em outro lugar.
 */
function mascararChavePix(valor, tipo) {
  const v = String(valor ?? '')
  if (!v) return null

  if (tipo === 'EMAIL' || v.includes('@')) {
    const [nome, dominio] = v.split('@')
    const inicio = nome.slice(0, 2)
    return `${inicio}${'*'.repeat(Math.max(1, nome.length - 2))}@${dominio ?? ''}`
  }

  if (tipo === 'CPF') return mascararDocumento(v)

  // Telefone e chave aleatória: só os quatro últimos, que é o que se confere.
  const limpo = v.replace(/\s/g, '')
  return limpo.length > 4 ? `${'*'.repeat(Math.max(3, limpo.length - 4))}${limpo.slice(-4)}` : '****'
}

/**
 * Devolve o produtor sem os dados pessoais em claro.
 *
 * Repare que os campos NÃO são apagados: eles continuam presentes, mascarados.
 * Apagar faria a tela mostrar um travessão, que se confunde com "não tem CPF
 * cadastrado" — e a diferença entre "não posso ver" e "não existe" é
 * exatamente o que o usuário precisa entender.
 */
function ocultarDoProdutor(produtor) {
  if (!produtor) return produtor
  return {
    ...produtor,
    cpfCnpj: produtor.cpfCnpj ? mascararDocumento(produtor.cpfCnpj) : produtor.cpfCnpj,
    chavePix: produtor.chavePix ? mascararChavePix(produtor.chavePix, produtor.tipoChavePix) : produtor.chavePix,
    // A conta bancária segue o mesmo raciocínio: número de conta é destino de
    // dinheiro, e quem não paga não precisa dele.
    conta: produtor.conta ? mascararChavePix(produtor.conta, null) : produtor.conta,
    sigiloso: true,
  }
}

/**
 * Tira da carga o que o perfil não pode ver.
 *
 * `veDinheiro` false remove preço e valor em vez de zerá-los: zero é um número,
 * e número somado dá total errado. Ausência a tela sabe tratar — já trata, para
 * a carga que ainda não tem preço.
 */
function ocultarDaCarga(carga, { veDinheiro }) {
  if (!carga) return carga
  const limpa = { ...carga }

  if (limpa.produtor?.cpfCnpj) {
    limpa.produtor = { ...limpa.produtor, cpfCnpj: mascararDocumento(limpa.produtor.cpfCnpj) }
  }

  if (!veDinheiro) {
    delete limpa.precoBaseKg
    if (limpa.analise) {
      limpa.analise = { ...limpa.analise }
      delete limpa.analise.precoAjustadoKg
      delete limpa.analise.valorTotal
    }
    limpa.semValores = true
  }

  return limpa
}

module.exports = { mascararDocumento, mascararChavePix, ocultarDoProdutor, ocultarDaCarga }
