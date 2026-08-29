// ---------------------------------------------------------------------------
// COMPONENTES DE INTERFACE · as peças reutilizáveis do MATECH
// ---------------------------------------------------------------------------
// Painel, tabela, botão, campo, indicador e marcador de situação.
// Toda tela é montada com estas peças — por isso a aparência fica igual em
// todo lugar e uma mudança de estilo se propaga sozinha.
//
// As classes vêm do Tailwind, usando as cores declaradas no index.css.

import { useEffect, useState } from 'react'
import { TAMANHO, SITUACAO, ICONE_DA_ACAO } from '../lib/icones'

/**
 * Desenha um ícone do mapa de lib/icones.js.
 *
 * Existe para que as três regras do conjunto sejam obedecidas sem ninguém
 * precisar lembrar delas:
 *
 *   · traço 1.75 — o 2 padrão da lucide fica pesado ao lado da IBM Plex, que
 *     é uma fonte de haste fina; lado a lado, o ícone gritava mais que a
 *     palavra que ele deveria estar ajudando a achar;
 *   · cor herdada — `currentColor`, sempre. Ícone com cor própria vira um
 *     segundo foco dentro da mesma linha. A única exceção é o selo de
 *     situação, e lá a cor é do selo inteiro, texto junto;
 *   · `aria-hidden` — o ícone nunca é a informação, é a repetição visual de
 *     um texto que está ao lado. Lido em voz alta, ele duplicaria o rótulo.
 *     Onde o texto some (a barra recolhida), quem responde é o aria-label do
 *     botão, não o ícone.
 *
 * `de` aceita undefined de propósito: uma tela que ainda não tem ícone
 * declarado continua funcionando, só sem desenho.
 */
export function Icone({ de: Desenho, tamanho = TAMANHO.menu, className = '' }) {
  if (!Desenho) return null
  return <Desenho size={tamanho} strokeWidth={1.75} className={`shrink-0 ${className}`} aria-hidden="true" />
}

export function Botao({ children, variante = 'secundario', icone, className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 rounded-[3px] px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const estilos = {
    primario: 'bg-mate-700 text-white font-semibold hover:bg-mate-900',
    secundario: 'bg-white text-tinta border border-borda hover:bg-cabecalho',
    perigo: 'bg-white text-perigo border border-borda hover:bg-perigo-bg',
  }
  return (
    <button className={`${base} ${estilos[variante]} ${className}`} {...props}>
      <Icone de={icone} tamanho={TAMANHO.botao} />
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
        <span className="text-[11px] font-medium text-cinza-600">{rotulo}</span>
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
        <span className="text-[11px] font-medium text-cinza-600">{rotulo}</span>
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

/**
 * Faixa de indicadores · o primeiro dos três níveis da página.
 *
 * A tela tinha um nível só. Filtros, indicadores e tabelas eram todos a mesma
 * caixa branca, com a mesma borda, o mesmo canto e o mesmo fundo — e quando
 * tudo tem o mesmo peso, o olho não sabe por onde começar. Nada dizia que os
 * indicadores são o resumo e a tabela é o detalhe; eram só caixas, em ordem
 * de cima para baixo.
 *
 * Os três níveis, agora:
 *
 *   1. INDICADOR — sem caixa. Número grande direto sobre o fundo da página.
 *      Ele não precisa de contorno porque não é uma coisa que se abre nem se
 *      percorre: é um número que se lê de longe, e caixa em volta de número
 *      só rouba contraste dele.
 *   2. PAINEL — caixa branca com borda. Aqui a borda trabalha: ela delimita
 *      uma região que se percorre, e diz onde a tabela começa e termina.
 *   3. FILTRO — faixa discreta, sem caixa nenhuma. É controle, não conteúdo.
 *
 * O espaço faz a outra metade do trabalho: 24px ENTRE os blocos contra 8 a
 * 12px DENTRO deles. Essa razão é o que agrupa — o olho lê como uma coisa só
 * aquilo que está junto, e como coisas separadas aquilo que tem ar no meio.
 * (O estudo pedia de 32 a 40px; 24 é o que sobrevive num sistema de operação
 * onde a tabela precisa caber na tela sem rolar. A razão de 2 a 3 vezes, que
 * é o que cria a hierarquia, continua de pé.)
 */
export function FaixaDeIndicadores({ children, className = '' }) {
  return (
    <div className={`mb-6 flex flex-wrap items-start gap-x-8 gap-y-5 ${className}`}>
      {children}
    </div>
  )
}

/** Indicador numérico. Vive na faixa acima, sem caixa em volta. */
export function Indicador({ rotulo, valor, unidade, apoio, icone, vazio, cor = 'text-tinta' }) {
  return (
    <div className="min-w-[140px] flex-1">
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
        <Icone de={icone} tamanho={TAMANHO.indicador} />
        <span className="truncate">{rotulo}</span>
      </p>
      {/* ZERO NÃO É UM NÚMERO ÚTIL AQUI.
          "0 cargas" em corpo 26 tem o mesmo peso visual de "184 cargas", e o
          olho lê primeiro o tamanho: um painel cheio de zeros grandes parece
          um painel que não carregou. Quem passa `vazio` troca o zero por uma
          frase — que ocupa menos, diz mais, e não compete com os números que
          têm alguma coisa a dizer.

          QUEM DECIDE É QUEM CHAMA, e não este componente. A primeira versão
          testava o valor aqui dentro, e testar aqui é impossível de acertar:
          `valor` chega já formatado, então "R$ 0,00" e "R$ 33.709,44" são os
          dois texto, e qualquer conversão numérica devolve NaN para os dois.
          A regra virou simples — se veio `vazio`, mostra `vazio` — e a tela,
          que tem o número cru na mão, passa `null` quando não é zero. */}
      {vazio ? (
        <p className="mt-1.5 text-xs text-cinza-400">{vazio}</p>
      ) : (
        <p className={`mt-1.5 flex items-baseline gap-1.5 ${cor}`}>
          <span className="text-[26px] font-bold leading-none tabular">{valor}</span>
          {unidade && <span className="truncate text-[11px] font-medium text-cinza-400">{unidade}</span>}
        </p>
      )}
      {/* line-clamp-2 e não truncate: a linha de apoio é uma frase, e frase
          cortada na primeira linha perde justamente o predicado — "a balança
          pesa mais que o…". Duas linhas cabem; o title guarda o resto. */}
      {apoio && <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-cinza-600" title={apoio}>{apoio}</p>}
    </div>
  )
}

/**
 * Selo de situação · pílula com fundo tonal, ícone e texto.
 *
 * Era um quadrado de 7 pixels com o texto ao lado, e ele falhava nas duas
 * pontas. De perto, o quadrado é pequeno demais para uma cor ser lida como
 * cor. De longe — que é como esta coluna é lida de verdade, correndo o olho
 * pela tabela — só o vermelho aparecia; os três verdes viravam um só.
 *
 * A pílula resolve porque a cor passa a ocupar área, e porque o ícone diz a
 * mesma coisa por um segundo canal: quem não distingue o âmbar do verde
 * ainda distingue um documento de uma cédula. Isso não é detalhe de
 * acessibilidade avulso — é o que faz a coluna funcionar num monitor de
 * balança, com poeira na tela e o sol batendo.
 *
 * Mapa em lib/icones.js: desenho, texto e tom moram juntos porque mudam
 * juntos.
 */
const TOM_DA_SITUACAO = {
  espera: 'border-borda bg-cabecalho text-cinza-600',
  analise: 'border-analise-bg bg-analise-bg text-analise',
  ordem: 'border-[#ead9b0] bg-alerta-bg text-alerta',
  paga: 'border-mate-100 bg-mate-100 text-mate-700',
  reprovada: 'border-perigo-bg bg-perigo-bg text-perigo',
}

export function Situacao({ valor }) {
  const s = SITUACAO[valor] || { rotulo: valor, tom: 'espera' }
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] font-semibold ${TOM_DA_SITUACAO[s.tom]}`}
    >
      <Icone de={s.icone} tamanho={TAMANHO.selo} />
      {s.rotulo}
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
 *   · `fixar`   — 'direita'. A coluna para de rolar junto e cola na borda.
 *
 * SOBRE `fixar` — por que uma coluna precisa disso:
 *
 * Quando a tabela estoura a largura, o que sai da tela é o fim da linha. E o
 * fim da linha era justamente a situação da carga — "Analisa…", "Reprov…" —
 * que é a coluna que o operador de balança mais olha. A informação mais
 * procurada era a primeira a ser cortada, e para lê-la era preciso rolar de
 * lado, o que desalinha a linha do olho e faz perder de qual carga se estava
 * falando.
 *
 * Fixar resolve sem esconder nada: a coluna fica ancorada na borda direita e o
 * resto rola por baixo dela. A sombra à esquerda é o que avisa que existe
 * conteúdo passando ali embaixo — sem ela, a coluna fixa parece só o fim da
 * tabela, e ninguém rola.
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
                className={`whitespace-nowrap px-2.5 py-2 text-[11px] font-medium text-cinza-600 xl:px-3 ${
                  c.alinhar === 'direita' ? 'text-right' : ''
                } ${c.oculta ? OCULTAR_ABAIXO_DE[c.oculta] : ''} ${
                  c.fixar === 'direita' ? 'sticky right-0 z-20 bg-cabecalho' : ''
                }`}
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
            // O fundo da linha precisa ser conhecido AQUI, e não só no <tr>: a
            // célula fixa sai do fluxo e flutua sobre as outras, então ela tem
            // de pintar o próprio fundo — senão o texto que passa por baixo
            // aparece através dela.
            const fundo =
              linhaAtiva != null && linhaAtiva === linha.id
                ? 'bg-mate-100'
                : i % 2 ? 'bg-zebra' : 'bg-white'
            return (
              <tr
                key={linha.id ?? i}
                onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                className={`group border-b border-borda ${fundo} ${
                  aoClicarLinha ? 'cursor-pointer hover:bg-cabecalho' : ''
                }`}
              >
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={`px-2.5 py-2 text-[11.5px] xl:px-3 ${
                      c.quebrar ? 'min-w-[200px]' : 'whitespace-nowrap'
                    } ${c.alinhar === 'direita' ? 'text-right tabular' : ''} ${
                      c.forte ? 'font-semibold text-tinta' : 'text-cinza-600'
                    } ${c.oculta ? OCULTAR_ABAIXO_DE[c.oculta] : ''} ${
                      c.fixar === 'direita'
                        ? `sticky right-0 z-10 ${fundo} shadow-[-9px_0_9px_-9px_rgba(31,36,34,0.16)] ${
                            aoClicarLinha ? 'group-hover:bg-cabecalho' : ''
                          }`
                        : ''
                    }`}
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
 * Barra de filtros do sistema.
 *
 * O QUE MUDOU, E POR QUÊ.
 *
 * Antes esta barra ficava sempre aberta, com todos os campos à mostra, logo
 * abaixo do título — noventa pixels de altura, em toda tela, quase sempre
 * vazios: `dd/mm/aaaa`, `dd/mm/aaaa`, `Todos os produtores`. Era a primeira
 * coisa que a pessoa via ao abrir uma tela, e não era o que ela veio ver.
 * Filtro é ferramenta: importa quando se precisa dele, e o resto do tempo
 * ele deveria ocupar o tamanho de um botão.
 *
 * Agora a barra tem uma linha só. Nela ficam:
 *
 *   · a BUSCA, quando a tela tem uma — porque busca não é filtro no mesmo
 *     sentido. Ninguém 'abre a busca': digita nela. Escondê-la atrás de um
 *     clique custaria um gesto a cada pergunta feita no telefone;
 *   · o botão que abre o painel, com a contagem do que está aplicado;
 *   · um SELO por filtro ativo, com o × que remove aquele sozinho.
 *
 * Os selos são a parte que importa. Com o painel fechado, eles são a única
 * coisa que responde 'por que esta lista está assim?' — e essa pergunta é
 * exatamente a que faz alguém achar que o sistema perdeu dados, quando na
 * verdade sobrou um filtro de ontem. Um painel fechado sem selos esconderia
 * o recorte; com eles, o recorte fica dito em voz alta e some com um clique.
 *
 * O painel abre POR CIMA, e não empurrando o conteúdo: quem abre o filtro
 * está olhando para a tabela e quer ver o efeito da mudança. Empurrar a
 * tabela para baixo tira do campo de visão a coisa que se está tentando
 * ajustar.
 */
export function Filtros({ children, busca, ativos = [], aoRemover, aoLimpar }) {
  const [aberto, setAberto] = useState(false)

  // Esc fecha. É a tecla que a pessoa já aperta por reflexo diante de
  // qualquer coisa que abriu por cima — e quando nada acontece, ela conclui
  // que o painel travou.
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e) { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  const temPainel = Boolean(children)

  return (
    // items-end e não items-center: o campo de busca é mais alto que o
    // botão, porque carrega o rótulo em cima. Centralizados, os dois ficam
    // desencontrados; alinhados pela base, a linha volta a ser uma linha.
    <div data-fora-da-impressao className="relative mb-4 flex flex-wrap items-end gap-2">
      {busca}

      {temPainel && (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className={`inline-flex shrink-0 items-center gap-2 rounded-[3px] border px-3 py-2 text-xs font-medium transition-colors ${
            aberto || ativos.length
              ? 'border-mate-500 bg-white text-mate-700'
              : 'border-borda bg-white text-cinza-600 hover:border-mate-500 hover:text-mate-700'
          }`}
        >
          <Icone de={ICONE_DA_ACAO.filtrar} tamanho={TAMANHO.botao} />
          Filtros
          {ativos.length > 0 && (
            <span className="rounded-full bg-mate-700 px-1.5 text-[10px] font-bold text-white tabular">
              {ativos.length}
            </span>
          )}
        </button>
      )}

      {ativos.map((f) => (
        <span
          key={f.chave}
          className="inline-flex items-center gap-1 rounded-full border border-borda bg-white py-[3px] pl-2.5 pr-1 text-[11px] font-medium text-cinza-600"
        >
          {f.texto}
          {aoRemover && (
            <button
              type="button"
              onClick={() => aoRemover(f.chave)}
              aria-label={`Remover o filtro ${f.texto}`}
              title={`Remover o filtro ${f.texto}`}
              className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-cinza-400 hover:bg-cabecalho hover:text-perigo"
            >
              <Icone de={ICONE_DA_ACAO.limpar} tamanho={12} />
            </button>
          )}
        </span>
      ))}

      {ativos.length > 1 && aoLimpar && (
        <button
          type="button"
          onClick={aoLimpar}
          className="text-[11px] font-medium text-cinza-400 underline-offset-2 hover:text-perigo hover:underline"
        >
          limpar tudo
        </button>
      )}

      {aberto && temPainel && (
        <>
          {/* Camada invisível: um clique em qualquer lugar da tela fecha o
              painel. Sem ela, o painel só fecharia pelo próprio botão — e
              quem abre um painel por engano fecha clicando fora, não
              procurando de novo o botão que abriu. */}
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-full rounded-[3px] border border-borda bg-white shadow-[0_8px_24px_-8px_rgba(31,36,34,0.22)]">
            <div className="flex flex-wrap items-end gap-2 px-3 py-3 xl:gap-2.5">{children}</div>
            <div className="flex items-center justify-between gap-3 border-t border-borda px-3 py-2">
              <button
                type="button"
                onClick={aoLimpar}
                disabled={!ativos.length}
                className="text-[11px] font-medium text-cinza-400 hover:text-perigo disabled:opacity-40 disabled:hover:text-cinza-400"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-[11px] font-semibold text-mate-700 hover:underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
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
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-borda px-2 py-1 text-[10px] font-semibold text-cinza-600 hover:border-mate-500 hover:text-mate-700"
        >
          <Icone de={ICONE_DA_ACAO.baixar} tamanho={TAMANHO.tabela} />
          Baixar {nome}
        </button>
      )}
      <button
        onClick={() => window.print()}
        title="Abre a impressão do navegador, que também salva em PDF"
        className="inline-flex items-center gap-1.5 rounded-[2px] border border-borda px-2 py-1 text-[10px] font-semibold text-cinza-600 hover:border-mate-500 hover:text-mate-700"
      >
        <Icone de={ICONE_DA_ACAO.imprimir} tamanho={TAMANHO.tabela} />
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
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-cinza-600 marker:hidden hover:text-mate-700">
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
    <span className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-semibold ${tons[tom]}`}>
      {children}
    </span>
  )
}

/** Par rótulo/valor. Usado no detalhe do produtor e nas configurações. */
export function LinhaDado({ rotulo, valor, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-cinza-600">{rotulo}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-tinta">
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
        <span className="text-[11px] font-medium text-cinza-600">{rotulo}</span>
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
        <span className={`text-base font-bold tabular ${alerta ? 'text-alerta' : 'text-tinta'}`}>
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
// Paginação
// ---------------------------------------------------------------------------
// A rota de cargas devolve { total, pagina, porPagina } desde sempre, e a tela
// usava só as vinte primeiras linhas — sem nenhum jeito de ver a vigésima
// primeira. Numa ervateira que recebe quinze caminhões por dia, isso é o
// histórico do dia anterior fora de alcance.
//
// DUAS DECISÕES:
//
// 1. NÚMEROS DE PÁGINA, e não "carregar mais". Quem procura uma carga antiga
//    quer voltar a um ponto e voltar de novo depois; uma lista que só cresce
//    obriga a rolar tudo outra vez a cada consulta. E o total já vem do banco,
//    então dizer "página 3 de 12" não custa consulta nenhuma.
//
// 2. A FAIXA ANDA COM A PÁGINA ATUAL. Com trinta páginas, mostrar as trinta
//    ocuparia mais espaço que a tabela. Mostra-se a primeira, a última e as
//    vizinhas da atual — que é onde o dedo vai.
export function Paginacao({ pagina, porPagina, total, aoTrocar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (paginas <= 1) return null

  const primeiraLinha = (pagina - 1) * porPagina + 1
  const ultimaLinha = Math.min(pagina * porPagina, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-3 py-2.5">
      <span className="text-[10.5px] text-cinza-600">
        {primeiraLinha}–{ultimaLinha} de {total.toLocaleString('pt-BR')}
      </span>

      <div className="flex items-center gap-1">
        <BotaoDePagina rotulo="anterior" disabled={pagina <= 1} aoClicar={() => aoTrocar(pagina - 1)}>
          ‹
        </BotaoDePagina>

        {faixaDePaginas(pagina, paginas).map((n, i) =>
          n === null ? (
            <span key={`vao-${i}`} className="px-1 text-[11px] text-cinza-400">…</span>
          ) : (
            <BotaoDePagina key={n} ativo={n === pagina} aoClicar={() => aoTrocar(n)} rotulo={`página ${n}`}>
              {n}
            </BotaoDePagina>
          )
        )}

        <BotaoDePagina rotulo="próxima" disabled={pagina >= paginas} aoClicar={() => aoTrocar(pagina + 1)}>
          ›
        </BotaoDePagina>
      </div>
    </div>
  )
}

function BotaoDePagina({ children, ativo = false, disabled = false, aoClicar, rotulo }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={disabled}
      aria-label={rotulo}
      aria-current={ativo ? 'page' : undefined}
      // min-h-[32px] e não py-1: em tela de toque o alvo precisa de altura, e
      // o padding sozinho encolhe quando o número tem um dígito só.
      className={`min-h-[32px] min-w-[32px] rounded-[3px] px-2 text-[11.5px] font-medium tabular transition-colors disabled:opacity-30 ${
        ativo
          ? 'bg-mate-700 text-white'
          : 'text-cinza-600 hover:bg-cabecalho hover:text-tinta'
      }`}
    >
      {children}
    </button>
  )
}
