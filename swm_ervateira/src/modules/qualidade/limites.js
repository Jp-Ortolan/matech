// ---------------------------------------------------------------------------
// REGRA · o que reprova uma carga
// ---------------------------------------------------------------------------
// Pura, sem banco e sem HTTP, porque é a regra mais delicada do sistema: ela
// decide se um produtor recebe ou não pelo caminhão que entregou.
//
// COMO A DECISÃO É REPARTIDA, e por quê:
//
// O servidor CONFERE, o analista DECIDE. A conferência é objetiva — o número
// medido passou do limite gravado, ou não passou — e o sistema faz isso melhor
// que qualquer pessoa às cinco da tarde. Mas a decisão continua sendo de quem
// tem a amostra na mão: uma carga um ponto acima do limite, de um produtor de
// vinte anos, num dia de chuva, é uma conversa, não uma conta.
//
// O que o sistema garante é que a conversa fique registrada: se o analista
// aprovar apesar do limite estourado, ou reprovar sem nenhum limite estourado,
// ele escreve por quê, e isso fica na análise.
//
// LIMITE NULO É AUSÊNCIA DE REGRA, não zero. A ervateira que não reprova por
// umidade deixa o campo em branco, e nenhuma umidade reprova. Zero seria o
// contrário: reprovaria tudo.

/**
 * Confere as medidas contra os limites e devolve o que estourou.
 *
 * Devolve uma lista, e não um booleano, porque duas coisas podem estar erradas
 * ao mesmo tempo — e "reprovada" sem dizer qual é a informação que falta ao
 * produtor quando ele pergunta.
 */
function conferirLimites(medidas, limites) {
  const { palitoPercentual, umidadePercentual, folhaPercentual } = medidas ?? {}
  const { palitoMaximo, umidadeMaxima, folhaMinima } = limites ?? {}
  const motivos = []

  if (palitoMaximo != null && palitoPercentual != null && Number(palitoPercentual) > Number(palitoMaximo)) {
    motivos.push({
      campo: 'palito',
      rotulo: 'Palito',
      medido: Number(palitoPercentual),
      limite: Number(palitoMaximo),
      comparacao: 'acima',
      texto: `Palito de ${formatarPercentual(palitoPercentual)}, acima do máximo de ${formatarPercentual(palitoMaximo)}.`,
    })
  }

  if (umidadeMaxima != null && umidadePercentual != null && Number(umidadePercentual) > Number(umidadeMaxima)) {
    motivos.push({
      campo: 'umidade',
      rotulo: 'Umidade',
      medido: Number(umidadePercentual),
      limite: Number(umidadeMaxima),
      comparacao: 'acima',
      texto: `Umidade de ${formatarPercentual(umidadePercentual)}, acima do máximo de ${formatarPercentual(umidadeMaxima)}.`,
    })
  }

  // Folha é o único invertido: aqui menos é pior. Quem compra erva-mate compra
  // folha; o resto é palito e galho.
  if (folhaMinima != null && folhaPercentual != null && Number(folhaPercentual) < Number(folhaMinima)) {
    motivos.push({
      campo: 'folha',
      rotulo: 'Folha',
      medido: Number(folhaPercentual),
      limite: Number(folhaMinima),
      comparacao: 'abaixo',
      texto: `Folha de ${formatarPercentual(folhaPercentual)}, abaixo do mínimo de ${formatarPercentual(folhaMinima)}.`,
    })
  }

  return motivos
}

/**
 * Reconstrói, a partir de uma análise já gravada, por que a carga foi reprovada.
 *
 * Usa os limites COPIADOS na análise, e não os parâmetros de hoje: um laudo de
 * seis meses atrás tem de continuar dizendo o que dizia, mesmo que a ervateira
 * tenha mudado a régua depois.
 *
 * Devolve sempre uma lista de frases, para a tela e para o ticket:
 *   · limites estourados, deduzidos das medidas
 *   · o motivo escrito pelo analista, quando houver
 */
function motivosDaAnalise(analise) {
  if (!analise) return []

  const estourados = conferirLimites(
    {
      palitoPercentual: analise.palitoPercentual,
      umidadePercentual: analise.umidadePercentual,
      folhaPercentual: analise.folhaPercentual,
    },
    {
      palitoMaximo: analise.palitoMaximo,
      umidadeMaxima: analise.umidadeMaxima,
      folhaMinima: analise.folhaMinima,
    }
  )

  const frases = estourados.map((m) => m.texto)
  if (analise.motivoReprovacao) frases.push(analise.motivoReprovacao)
  return frases
}

/**
 * O analista precisa justificar quando contraria a conferência?
 *
 * Sim nos dois sentidos, e é o mesmo princípio: sempre que a decisão humana
 * discorda da régua, o porquê fica escrito. Sem isso, seis meses depois
 * ninguém sabe se foi critério ou descuido.
 */
function exigeJustificativa({ aprovada, limitesEstourados }) {
  if (!aprovada && limitesEstourados.length === 0) return 'reprovou sem limite estourado'
  if (aprovada && limitesEstourados.length > 0) return 'aprovou com limite estourado'
  return null
}

function formatarPercentual(v) {
  return `${Number(v).toFixed(1).replace('.', ',')}%`
}

module.exports = { conferirLimites, motivosDaAnalise, exigeJustificativa }
