// ---------------------------------------------------------------------------
// SERVIÇO · cargas (pesagem e cálculo de pagamento)
// ---------------------------------------------------------------------------
// Aqui moram as regras de negócio do recebimento. Nenhuma linha deste arquivo
// conhece HTTP — o que permite testá-lo isoladamente, como o Quadro 8 do
// artigo prevê para o RF10.

const { prisma } = require('../../lib/prisma')
const { ErroDeNegocio } = require('../../middlewares/erros')

// ---------------------------------------------------------------------------
// REGRA 1 · peso líquido
// ---------------------------------------------------------------------------
// O que a balança mede é o caminhão cheio (bruto). A tara é o peso do veículo
// vazio. O que a ervateira compra é a diferença.
function calcularPesoLiquido(pesoBrutoKg, taraKg) {
  const bruto = Number(pesoBrutoKg)
  const tara = Number(taraKg)

  if (!(bruto > 0)) throw new ErroDeNegocio('O peso bruto deve ser maior que zero', 400)
  if (tara < 0) throw new ErroDeNegocio('A tara não pode ser negativa', 400)
  if (tara >= bruto) throw new ErroDeNegocio('A tara não pode ser maior ou igual ao peso bruto', 400)

  return Number((bruto - tara).toFixed(2))
}

// ---------------------------------------------------------------------------
// REGRA 2 · preço combinado na entrega
// ---------------------------------------------------------------------------
// O preço por quilo é digitado na balança e é ele que multiplica o peso no fim
// do ciclo. Precisa ser validado AQUI, no registro, e não só no cálculo do
// pagamento: quem digita é o operador de balança, e quem descobriria o erro
// seria o analista de qualidade, horas depois, sem saber o preço combinado.
//
// Um preço zerado não gera erro nenhum mais adiante — gera uma ordem de
// pagamento de R$ 0,00, que é bem pior que um erro.
function validarPrecoBase(precoBaseKg) {
  if (precoBaseKg === undefined || precoBaseKg === null || precoBaseKg === '') {
    throw new ErroDeNegocio('Informe o preço por quilograma combinado', 400)
  }
  const preco = Number(precoBaseKg)
  if (!Number.isFinite(preco)) {
    throw new ErroDeNegocio('O preço por quilograma precisa ser um número', 400)
  }
  if (!(preco > 0)) {
    throw new ErroDeNegocio('O preço por quilograma deve ser maior que zero', 400)
  }
  return Number(preco.toFixed(4))   // o banco guarda quatro casas
}

// ---------------------------------------------------------------------------
// REGRA 3 · cálculo do pagamento  (RF10 · Expressão 1 do artigo)
// ---------------------------------------------------------------------------
// A expressão original do artigo é:  valor = peso líquido × preço por quilo.
//
// O levantamento na ervateira mostrou que falta uma etapa: o percentual de
// palito medido no laboratório desconta o preço. Então o cálculo real é:
//
//     excedente        = palito medido − limite aceito   (nunca negativo)
//     desconto (%)     = excedente × percentual por ponto
//     preço ajustado   = preço base × (1 − desconto/100)
//     valor total      = peso líquido × preço ajustado
//
// ATENÇÃO: limite de 30% e 1% de desconto por ponto percentual são valores
// PROVISÓRIOS. A fórmula oficial ainda será confirmada com a ervateira.
// Quando vier, muda-se só este arquivo.
function calcularPagamento({
  pesoLiquidoKg,
  precoBaseKg,
  palitoPercentual = null,
  limitePalito = 30,
  descontoPorPonto = 1,
}) {
  const peso = Number(pesoLiquidoKg)
  const precoBase = Number(precoBaseKg)

  if (!(peso > 0)) throw new ErroDeNegocio('O peso líquido deve ser maior que zero', 400)
  if (!(precoBase > 0)) throw new ErroDeNegocio('O preço por quilograma deve ser maior que zero', 400)

  // Sem análise de laboratório ainda: não há desconto a aplicar.
  const palito = palitoPercentual === null ? null : Number(palitoPercentual)

  const excedente = palito === null ? 0 : Math.max(0, palito - Number(limitePalito))
  const descontoPercentual = Number((excedente * Number(descontoPorPonto)).toFixed(4))
  const precoAjustadoKg = Number((precoBase * (1 - descontoPercentual / 100)).toFixed(4))
  const valorTotal = Number((peso * precoAjustadoKg).toFixed(2))

  return {
    pesoLiquidoKg: peso,
    precoBaseKg: precoBase,
    palitoPercentual: palito,
    limitePalito: Number(limitePalito),
    excedentePalito: Number(excedente.toFixed(2)),
    descontoPercentual,
    precoAjustadoKg,
    valorTotal,
  }
}

// ---------------------------------------------------------------------------
// CONSULTA · histórico com filtros  (RF12 a RF14)
// ---------------------------------------------------------------------------
async function listar({ produtorId, de, ate, situacao, pagina = 1, porPagina = 20 }) {
  const where = {}
  if (produtorId) where.produtorId = produtorId
  if (situacao) where.situacao = situacao
  if (de || ate) {
    where.dataHora = {}
    if (de) where.dataHora.gte = new Date(de)
    if (ate) where.dataHora.lte = new Date(ate)
  }

  // $transaction roda as duas consultas de uma vez só, o que evita
  // que o total e a lista fiquem inconsistentes entre si.
  const [total, cargas] = await prisma.$transaction([
    prisma.carga.count({ where }),
    prisma.carga.findMany({
      where,
      orderBy: { dataHora: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        produtor: { select: { id: true, nome: true, cpfCnpj: true } },
        motorista: { select: { nome: true } },
        veiculo: { select: { placa: true } },
        analise: true,
      },
    }),
  ])

  return { total, pagina, porPagina, cargas }
}

// ---------------------------------------------------------------------------
// COMANDO · registrar pesagem  (RF06 a RF09)
// ---------------------------------------------------------------------------
async function registrarPesagem(dados, usuarioId) {
  const {
    produtorId, ervalId, motoristaId, veiculoId, avaliacaoId,
    tipoMateriaPrima, pesoBrutoKg, taraKg, precoBaseKg,
    pesoEstimadoCampoKg, observacoes,
  } = dados

  if (!produtorId) throw new ErroDeNegocio('Informe o produtor', 400)
  if (!tipoMateriaPrima) throw new ErroDeNegocio('Informe o tipo de matéria-prima', 400)

  const pesoLiquidoKg = calcularPesoLiquido(pesoBrutoKg, taraKg)
  const precoValidado = validarPrecoBase(precoBaseKg)

  // A estimativa de campo é opcional, mas se vier tem de ser um número positivo:
  // é ela que sustenta o indicador de acurácia da avaliação no erval.
  let estimadoCampo = null
  if (pesoEstimadoCampoKg !== undefined && pesoEstimadoCampoKg !== null && pesoEstimadoCampoKg !== '') {
    estimadoCampo = Number(pesoEstimadoCampoKg)
    if (!Number.isFinite(estimadoCampo) || estimadoCampo <= 0) {
      throw new ErroDeNegocio('O peso estimado em campo deve ser maior que zero', 400)
    }
  }
  const daCarga = {
    produtorId, ervalId, motoristaId, veiculoId, avaliacaoId,
    usuarioId,                       // quem estava na balança
    tipoMateriaPrima,
    pesoBrutoKg: Number(pesoBrutoKg),
    taraKg: Number(taraKg),
    pesoLiquidoKg,                   // guardado calculado, para não recalcular a cada consulta
    pesoEstimadoCampoKg: estimadoCampo,
    precoBaseKg: precoValidado,
    observacoes,
    situacao: 'AGUARDANDO_ANALISE',
  }

  return criarComNumeroSequencial({
    modelo: prisma.carga,
    campo: 'numeroTicket',
    proximoNumero: gerarNumeroTicket,
    dados: daCarga,
    include: {
      produtor: { select: { nome: true, cpfCnpj: true } },
      motorista: { select: { nome: true } },
      veiculo: { select: { placa: true } },
    },
  })
}

// ---------------------------------------------------------------------------
// NUMERAÇÃO SEQUENCIAL SOB CONCORRÊNCIA
// ---------------------------------------------------------------------------
// O PROBLEMA QUE ISTO RESOLVE, e por que ele não é teórico:
//
// Gerar o número é "ler o maior e somar um". Entre a leitura e a gravação há
// uma janela — pequena, mas real. Se dois operadores de balança registrarem
// uma pesagem no mesmo instante, os dois leem PES-2026-00007, os dois tentam
// gravar PES-2026-00008, e o segundo esbarra no índice único. Sem tratamento,
// esse operador recebe um 409 "Registro duplicado" incompreensível e perde a
// pesagem — com o caminhão na balança esperando.
//
// E o RNF04 promete exatamente isso: uso simultâneo por múltiplos usuários.
//
// A SOLUÇÃO, e por que ela é a certa aqui:
//
// A unicidade continua sendo garantida pelo BANCO, através do índice único —
// não por um "if" no código, que não resolveria a corrida de jeito nenhum.
// O que este trecho faz é tratar a colisão como o que ela é: um evento
// esperado e recuperável. Se o número foi tomado, lê de novo e tenta o
// seguinte. A colisão é rara; três tentativas cobrem folgadamente uma balança
// com quatro operadores.
//
// A alternativa seria uma SEQUENCE do PostgreSQL, que elimina a corrida de
// vez. Ela não foi usada porque a numeração reinicia a cada ano e traz o ano
// no meio do texto (PES-2026-00001), o que exigiria uma sequence por ano e uma
// migração em SQL puro — complexidade que não se paga no volume desta
// ervateira, onde duas pesagens no mesmo milissegundo são a exceção.
const MAXIMO_DE_TENTATIVAS = 3

async function criarComNumeroSequencial({ modelo, campo, proximoNumero, dados, include }) {
  for (let tentativa = 1; tentativa <= MAXIMO_DE_TENTATIVAS; tentativa++) {
    try {
      return await modelo.create({
        data: { ...dados, [campo]: await proximoNumero() },
        include,
      })
    } catch (erro) {
      // P2002 é violação de campo único. Só interessa quando foi NESTE campo:
      // um CPF duplicado, por exemplo, também é P2002 e não se resolve
      // tentando de novo — precisa subir para quem chamou.
      const colidiuNoNumero =
        erro.code === 'P2002' &&
        (erro.meta?.target ?? []).some((alvo) => String(alvo).includes(campo))

      if (!colidiuNoNumero || tentativa === MAXIMO_DE_TENTATIVAS) throw erro
      // Colidiu: o laço volta e lê o próximo número, que já considera o
      // registro que o outro operador acabou de gravar.
    }
  }
}

// Numeração sequencial do ticket por ano: PES-2026-00001
async function gerarNumeroTicket() {
  const ano = new Date().getFullYear()
  const prefixo = `PES-${ano}-`
  const ultima = await prisma.carga.findFirst({
    where: { numeroTicket: { startsWith: prefixo } },
    orderBy: { numeroTicket: 'desc' },
    select: { numeroTicket: true },
  })
  const proximo = ultima ? Number(ultima.numeroTicket.slice(prefixo.length)) + 1 : 1
  return prefixo + String(proximo).padStart(5, '0')
}

async function buscarPorId(id) {
  const carga = await prisma.carga.findUnique({
    where: { id },
    include: { produtor: true, erval: true, motorista: true, veiculo: true, analise: true, avaliacao: true },
  })
  if (!carga) throw new ErroDeNegocio('Carga não encontrada', 404)
  return carga
}

module.exports = {
  criarComNumeroSequencial,
  calcularPesoLiquido,
  validarPrecoBase,
  calcularPagamento,
  listar,
  registrarPesagem,
  buscarPorId,
}
