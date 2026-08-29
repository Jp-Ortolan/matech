// ---------------------------------------------------------------------------
// COMPONENTES DE INTERFACE · as peças reutilizáveis do MATECH
// ---------------------------------------------------------------------------
// Painel, tabela, botão, campo, indicador e marcador de situação.
// Toda tela é montada com estas peças — por isso a aparência fica igual em
// todo lugar e uma mudança de estilo se propaga sozinha.
//
// As classes vêm do Tailwind, usando as cores declaradas no index.css.

import { useState } from 'react'

export function Botao({ children, variante = 'secundario', className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 rounded-[3px] px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const estilos = {
    primario: 'bg-mate-700 text-white font-semibold hover:bg-mate-800',
    secundario: 'bg-white text-tinta border border-borda hover:bg-cabecalho',
    perigo: 'bg-white text-perigo border border-borda hover:bg-perigo-bg',
  }
  return (
    <button className={`${base} ${estilos[variante]} ${className}`} {...props}>
      {children}
    </button>
  )
}

/**
 * Campo de texto.
 *
 * A largura mínima padrão é o que faz uma linha de formulário QUEBRAR em vez
 * de espremer: com três campos numa faixa de 600px, sem mínimo, cada um viraria
 * uma caixa de 180px onde não cabe um nome completo.
 *
 * Quem precisa de outro mínimo — o campo de UF, que tem duas letras — passa o
 * seu no className, e o padrão sai de cena. A verificação é explícita porque
 * duas classes utilitárias do mesmo tipo empatam em especificidade: quem vence
 * é a que sai depois na folha gerada, não a que vem depois no atributo.
 */
export function Campo({ rotulo, className = '', ...props }) {
  const minimo = className.includes('min-w') ? '' : 'min-w-[132px]'
  return (
    <label className={`flex ${minimo} flex-col gap-1.5 ${className}`}>
      {rotulo && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
          {rotulo}
        </span>
      )}
      <input
        className="rounded-[3px] border border-borda bg-white px-2.5 py-2 text-xs text-tinta outline-none focus:border-mate-500 disabled:bg-cabecalho disabled:text-cinza-400"
        {...props}
      />
    </label>
  )
}

export function Selecao({ rotulo, children, className = '', ...props }) {
  const minimo = className.includes('min-w') ? '' : 'min-w-[132px]'
  return (
    <label className={`flex ${minimo} flex-col gap-1.5 ${className}`}>
      {rotulo && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
          {rotulo}
        </span>
      )}
      <select
        className="rounded-[3px] border border-borda bg-white px-2.5 py-2 text-xs text-tinta outline-none focus:border-mate-500 disabled:bg-cabecalho disabled:text-cinza-400"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

/** Caixa branca com contorno e cabeçalho — a base de quase tudo. */
export function Painel({ titulo, acao, children, className = '' }) {
  return (
    <section className={`rounded-[3px] border border-borda bg-white ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-3 border-b border-borda px-3 py-2">
          <h2 className="truncate text-xs font-semibold text-tinta">{titulo}</h2>
          {acao && <span className="shrink-0 text-[11px] font-medium text-mate-700">{acao}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Indicador numérico da faixa superior do painel. */
export function Indicador({ rotulo, valor, unidade, apoio, cor = 'text-tinta' }) {
  return (
    <div className="min-w-[132px] flex-1 rounded-[3px] border border-borda bg-white px-3 py-2">
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-cinza-400">{rotulo}</p>
      <p className={`mt-0.5 flex items-baseline gap-1 ${cor}`}>
        <span className="text-xl font-bold tabular">{valor}</span>
        {unidade && <span className="truncate text-[10px] font-medium text-cinza-400">{unidade}</span>}
      </p>
      {/* line-clamp-2 e não truncate: a linha de apoio é uma frase, e frase
          cortada na primeira linha perde justamente o predicado — "a balança
          pesa mais que o…". Duas linhas cabem; o title guarda o resto. */}
      {apoio && <p className="mt-0.5 line-clamp-2 text-[10px] text-cinza-600" title={apoio}>{apoio}</p>}
    </div>
  )
}

/** Quadradinho colorido + texto. Substitui as etiquetas em pílula. */
export function Situacao({ valor }) {
  const mapa = {
    AGUARDANDO_ANALISE: ['bg-alerta', 'Em avaliação'],
    ANALISADA: ['bg-mate-500', 'Analisada'],
    EM_ORDEM_PAGAMENTO: ['bg-mate-500', 'Em ordem'],
    PAGA: ['bg-mate-700', 'Paga'],
    REPROVADA: ['bg-perigo', 'Reprovada'],
    PENDENTE: ['bg-alerta', 'Aguardando'],
    CANCELADA: ['bg-cinza-400', 'Cancelada'],
  }
  const [cor, texto] = mapa[valor] || ['bg-cinza-400', valor]
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-medium text-cinza-600">
      <span className={`h-[7px] w-[7px] rounded-[1px] ${cor}`} />
      {texto}
    </span>
  )
}

// --------------------------------- tabela ---------------------------------
// Uso:
//   <Tabela colunas={[{ chave:'nome', titulo:'PRODUTOR' }]} dados={lista} />

/**
 * Tabela do sistema.
 *
 * LARGURA — a regra que vale para todas as telas:
 *
 * A tabela ocupa o espaço que tem e distribui as colunas dentro dele. Rolagem
 * lateral é o último recurso, não o primeiro: quando aparece, é porque a tela
 * ficou estreita de verdade, e não porque a tabela pediu mais largura do que
 * precisava. O que resolve o enquadramento é escolher menos colunas — o dado
 * secundário fica no detalhe do registro, onde ele é procurado, e não na
 * linha, onde ele só atrapalha a comparação.
 *
 * Opções de coluna:
 *   · `truncar` — corta o texto com reticências em vez de esticar a coluna.
 *     Nome de produtor é o caso típico: um nome comprido não pode empurrar a
 *     coluna de peso para fora da tela.
 *   · `oculta`  — 'md' | 'lg' | 'xl'. Some abaixo daquela largura. É para o
 *     dado que ajuda quando há espaço e não faz falta quando não há.
 *   · `quebrar` — volta a se comportar como parágrafo (observações).
 */
const OCULTAR_ABAIXO_DE = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

/**
 * `aoClicarLinha` e `linhaAtiva` são opcionais e andam juntos.
 *
 * Existem porque uma coluna inteira ocupada por um botão escrito "abrir" é
 * espaço gasto para repetir, linha a linha, a única coisa que dá para fazer
 * com uma linha de tabela. Clicar na linha diz o mesmo sem coluna nenhuma —
 * e o realce da linha ativa diz qual está aberta melhor do que a palavra
 * "aberto" escrita na ponta.
 */
export function Tabela({ colunas, dados, vazio = 'Nenhum registro encontrado', rodape, aoClicarLinha, linhaAtiva }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-borda bg-cabecalho">
            {colunas.map((c) => (
              <th
                key={c.chave}
                className={`whitespace-nowrap px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wide text-cinza-400 xl:px-3 ${
                  c.alinhar === 'direita' ? 'text-right' : ''
                } ${c.oculta ? OCULTAR_ABAIXO_DE[c.oculta] : ''}`}
                style={c.largura ? { width: c.largura } : undefined}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.length === 0 && (
            <tr>
              <td colSpan={colunas.length} className="px-3 py-8 text-center text-xs text-cinza-400">
                {vazio}
              </td>
            </tr>
          )}
          {dados.map((linha, i) => {
            const conteudo = (c) => (c.render ? c.render(linha) : linha[c.chave])
            return (
              <tr
                key={linha.id ?? i}
                onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                className={`border-b border-borda ${
                  linhaAtiva != null && linhaAtiva === linha.id
                    ? 'bg-mate-100'
                    : i % 2 ? 'bg-zebra' : 'bg-white'
                } ${aoClicarLinha ? 'cursor-pointer hover:bg-cabecalho' : ''}`}
              >
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={`px-2.5 py-2 text-[11.5px] xl:px-3 ${
                      c.quebrar ? 'min-w-[200px]' : 'whitespace-nowrap'
                    } ${c.alinhar === 'direita' ? 'text-right tabular' : ''} ${
                      c.forte ? 'font-semibold text-tinta' : 'text-cinza-600'
                    } ${c.oculta ? OCULTAR_ABAIXO_DE[c.oculta] : ''}`}
                  >
                    {c.truncar ? (
                      <span
                        className="block truncate"
                        style={{ maxWidth: typeof c.truncar === 'number' ? c.truncar : 170 }}
                        title={typeof conteudo(c) === 'string' ? conteudo(c) : undefined}
                      >
                        {conteudo(c)}
                      </span>
                    ) : (
                      conteudo(c)
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {rodape && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] text-cinza-400">
          {rodape}
        </div>
      )}
    </div>
  )
}

/**
 * Barra de filtros padrão do sistema.
 *
 * Existe porque cinco telas montavam a mesma faixa branca à mão, com medidas
 * ligeiramente diferentes em cada uma — e faixa de filtro que muda de altura
 * de tela para tela é o tipo de detalhe que faz o conjunto parecer remendado.
 */
export function Filtros({ children }) {
  return (
    <div
      data-fora-da-impressao
      className="mb-3 flex flex-wrap items-end gap-2 rounded-[3px] border border-borda bg-white px-3 py-2.5 xl:gap-2.5"
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PEÇAS ACRESCENTADAS COM AS TELAS DE CADASTRO, PREÇOS, RELATÓRIOS E AJUSTES
// ---------------------------------------------------------------------------
// Todas nasceram do mesmo motivo: quatro telas precisavam da mesma coisa.
// Enquanto era uma tela só, o desenho podia ficar dentro dela — o Dashboard
// desenhava a barra proporcional à mão. Com quatro, isso vira repetição, e
// repetição de estilo é o que faz um sistema parecer remendado.

/** Barra proporcional: rótulo à esquerda, valor à direita, barra embaixo. */
export function Barra({ rotulo, valor, proporcao, cor = 'bg-mate-300' }) {
  const largura = Math.max(0, Math.min(100, Number(proporcao) || 0))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-tinta">{rotulo}</span>
        <span className="shrink-0 text-[11.5px] font-semibold tabular text-tinta">{valor}</span>
      </div>
      <div className="h-[7px] w-full bg-cabecalho">
        <div className={`h-full ${cor}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

/**
 * Barra de saída de um painel: exportar e imprimir.
 *
 * Existe porque a exportação estava escondida num link de texto de 10 pixels
 * no canto do cabeçalho, e quem usava o sistema simplesmente não a encontrava.
 * Uma função que ninguém acha é uma função que não existe.
 *
 * O botão de imprimir não gera PDF: ele chama a impressão do navegador, que
 * já sabe salvar em PDF. Escrever um gerador de PDF aqui seria manter um
 * segundo desenho do mesmo relatório — e dois desenhos divergem.
 */
export function SaidaDoPainel({ aoExportar, nome = 'CSV' }) {
  return (
    <span data-fora-da-impressao className="flex gap-1.5">
      {aoExportar && (
        <button
          onClick={aoExportar}
          className="rounded-[2px] border border-borda px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cinza-600 hover:border-mate-500 hover:text-mate-700"
        >
          Baixar {nome}
        </button>
      )}
      <button
        onClick={() => window.print()}
        title="Abre a impressão do navegador, que também salva em PDF"
        className="rounded-[2px] border border-borda px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cinza-600 hover:border-mate-500 hover:text-mate-700"
      >
        Imprimir / PDF
      </button>
    </span>
  )
}

/**
 * Bloco que abre e fecha — divulgação progressiva.
 *
 * O padrão existe para o caso em que a informação NÃO é dispensável, mas
 * também não é o que a maioria vem buscar. Apagá-la esconderia algo que
 * alguém precisa uma vez por mês; deixá-la aberta faz todo mundo pagar,
 * todo dia, o custo de rolar por ela.
 *
 * Usa o <details> nativo do HTML de propósito: ele já vem com teclado,
 * leitor de tela e o estado de aberto/fechado resolvidos. Reimplementar isso
 * com useState daria trinta linhas piores.
 */
export function Detalhes({ titulo, children, aberto = false }) {
  return (
    <details open={aberto} className="rounded-[3px] border border-borda bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-cinza-600 marker:hidden hover:text-mate-700">
        {titulo}
      </summary>
      <div className="border-t border-borda px-3 py-3">{children}</div>
    </details>
  )
}

/** Estado vazio padrão. Dizer "não há" é diferente de mostrar espaço em branco. */
export function Vazio({ texto = 'Nenhum registro encontrado' }) {
  return <p className="px-4 py-10 text-center text-xs text-cinza-400">{texto}</p>
}

/** Etiqueta curta. Ex.: "cadastrado em campo". */
export function Etiqueta({ children, tom = 'neutro' }) {
  const tons = {
    neutro: 'border-borda bg-cabecalho text-cinza-600',
    verde: 'border-mate-100 bg-mate-100 text-mate-700',
    alerta: 'border-[#e2c894] bg-alerta-bg text-alerta',
    perigo: 'border-perigo-bg bg-perigo-bg text-perigo',
  }
  return (
    <span className={`inline-flex items-center rounded-[2px] border px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide ${tons[tom]}`}>
      {children}
    </span>
  )
}

/** Par rótulo/valor. Usado no detalhe do produtor e nas configurações. */
export function LinhaDado({ rotulo, valor, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">{rotulo}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold text-tinta">
        {valor === null || valor === undefined || valor === '' ? '—' : valor}
      </p>
    </div>
  )
}

/** Abas. Uso: <Abas abas={[{ id, rotulo }]} ativa={id} aoTrocar={fn} /> */
export function Abas({ abas, ativa, aoTrocar }) {
  return (
    <div className="mb-3 flex gap-0 overflow-x-auto border-b border-borda">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => aoTrocar(a.id)}
          className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-xs transition-colors ${
            ativa === a.id
              ? 'border-mate-700 font-semibold text-mate-700'
              : 'border-transparent font-medium text-cinza-600 hover:text-tinta'
          }`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  )
}

/** Campo de texto de várias linhas, no mesmo desenho do Campo. */
export function AreaTexto({ rotulo, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
          {rotulo}
        </span>
      )}
      <textarea
        rows={3}
        className="resize-y rounded-[3px] border border-borda bg-white px-2.5 py-2 text-xs text-tinta outline-none focus:border-mate-500"
        {...props}
      />
    </label>
  )
}

/** Aviso curto no corpo da página. Serve para explicar uma regra, não um erro. */
export function Aviso({ children, tom = 'neutro' }) {
  const tons = {
    neutro: 'border-borda bg-cabecalho text-cinza-600',
    verde: 'border-mate-100 bg-mate-100 text-mate-700',
    alerta: 'border-[#e2c894] bg-alerta-bg text-alerta',
  }
  return (
    <div className={`rounded-[3px] border px-3 py-2.5 text-[10.5px] leading-relaxed ${tons[tom]}`}>
      {children}
    </div>
  )
}

// A formatação NÃO mora mais aqui. Ela vive em lib/formatar.js, e as telas
// importam de lá. Este arquivo cuida de como as coisas aparecem; aquele, de
// como os valores viram texto — e misturar os dois obrigava qualquer arquivo
// que precisasse formatar um número a arrastar a biblioteca de interface
// inteira junto.

export function Carregando({ texto = 'Carregando...' }) {
  return <p className="px-4 py-8 text-center text-xs text-cinza-400">{texto}</p>
}

export function Erro({ erro }) {
  if (!erro) return null
  return (
    <div className="rounded-[3px] border border-perigo-bg bg-perigo-bg px-3 py-2.5">
      <p className="text-[11.5px] font-semibold text-perigo">{erro.message}</p>
      {erro.detalhe && <p className="mt-0.5 text-[10.5px] text-perigo">{erro.detalhe}</p>}
    </div>
  )
}

/** Confirmação verde e curta. Some sozinha quando a tela recarrega os dados. */
export function Sucesso({ texto }) {
  if (!texto) return null
  return (
    <div className="rounded-[3px] border border-mate-100 bg-mate-100 px-3 py-2.5">
      <p className="text-[11.5px] font-semibold text-mate-700">{texto}</p>
    </div>
  )
}

/**
 * Medidor · uma razão medida contra um limite.
 *
 * Serve para o caso em que o número sozinho não responde a pergunta: 34% de
 * palito é muito? Só quem sabe que o limite acordado é 30% consegue responder.
 * O medidor põe os dois na mesma barra.
 *
 * A trilha é um passo CLARO DA MESMA COR do preenchimento, e não cinza: assim a
 * barra inteira comunica o estado, mesmo a parte vazia. O preenchimento troca
 * para a cor de alerta quando passa do limite — é a severidade indo para a cor,
 * que é o único trabalho que ela deveria ter aqui.
 *
 * A marca do limite é um traço fino sobre a trilha, com o valor escrito ao lado.
 * Ninguém precisa deduzir onde ele está pela cor.
 */
export function Medidor({ rotulo, texto, valor, maximo, limite, apoio, alerta = false }) {
  const escala = Number(maximo) || 1
  const preenchido = Math.max(0, Math.min(100, (Number(valor) / escala) * 100))
  const marca = limite == null ? null : Math.max(0, Math.min(100, (Number(limite) / escala) * 100))

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
          {rotulo}
        </span>
        <span className={`text-base font-bold tabular ${alerta ? 'text-alerta' : 'text-mate-700'}`}>
          {texto}
        </span>
      </div>

      <div className="relative mt-1.5 h-[10px] w-full bg-mate-100">
        <div
          className={`h-full ${alerta ? 'bg-alerta' : 'bg-mate-500'}`}
          style={{ width: `${preenchido}%` }}
        />
        {marca !== null && (
          <span
            className="absolute -top-[3px] h-[16px] w-[1px] bg-tinta"
            style={{ left: `${marca}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {apoio && <p className="mt-1.5 text-[10px] text-cinza-600">{apoio}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dado sigiloso
// ---------------------------------------------------------------------------
// Mostra o valor mascarado que veio do servidor e um botão para pedir o real.
//
// A ORDEM IMPORTA, e é o que diferencia isto de teatro: o número em claro não
// está na tela esperando ser revelado — ele nem saiu do servidor. O botão faz
// uma requisição, e é o servidor que decide se responde. Se o perfil não pode,
// volta 403 e o componente diz isso, em vez de fingir que o dado não existe.
//
// Depois de revelado, fica revelado até a tela ser recarregada. Esconder de
// novo sozinho seria irritante justamente para quem tem o direito de ver e
// está no meio de conferir um pagamento.
export function Sigiloso({ valor, aoRevelar, rotuloRevelar = 'mostrar' }) {
  const [aberto, setAberto] = useState(false)
  const [real, setReal] = useState(null)
  const [erro, setErro] = useState(null)
  const [pedindo, setPedindo] = useState(false)

  if (!valor) return <span className="text-cinza-400">—</span>

  async function revelar() {
    setPedindo(true)
    setErro(null)
    try {
      const v = await aoRevelar()
      if (v == null || v === '') {
        setErro({ message: 'não disponível' })
      } else {
        setReal(v)
        setAberto(true)
      }
    } catch (e) {
      setErro(e)
    } finally {
      setPedindo(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular">{aberto ? real : valor}</span>
      {!aberto && (
        <button
          type="button"
          onClick={revelar}
          disabled={pedindo}
          className="text-[10px] font-semibold text-mate-700 hover:underline disabled:opacity-50"
        >
          {pedindo ? '...' : rotuloRevelar}
        </button>
      )}
      {erro && (
        <span className="text-[10px] text-cinza-400" title={erro.detalhe || erro.message}>
          {erro.message?.includes('permiss') ? 'sem permissão' : erro.message}
        </span>
      )}
    </span>
  )
}
