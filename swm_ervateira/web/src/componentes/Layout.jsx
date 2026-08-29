// ---------------------------------------------------------------------------
// LAYOUT · a moldura do sistema
// ---------------------------------------------------------------------------
// Barra superior com a marca, o período, as notificações e o usuário; menu
// lateral fixo; e a área de conteúdo onde cada página é desenhada.
//
// Esta moldura é escrita UMA vez. Toda página nova só preenche o miolo,
// através do <Outlet /> do React Router. É aqui que o protótipo do Figma se
// converte em economia real de tempo.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import LimiteDeErro from './LimiteDeErro'
import { useAutenticacao, NOME_PERFIL } from '../contexto/Autenticacao'
import { secoesVisiveis } from '../lib/acesso'
import { ICONE_DA_TELA, TAMANHO } from '../lib/icones'
import { ContextoDoCabecalho, useNoDoCabecalho } from '../lib/cabecalho'
import { Icone } from './ui'
import Marca from './Marca'

/**
 * Item do menu.
 *
 * O marcador aqui era um quadradinho de 7 pixels, igual em todos os itens. Ele
 * não dizia nada aberto — e recolhido era pior que nada: onze quadradinhos
 * idênticos empilhados, um por tela, sem uma única pista de qual era qual. A
 * barra recolhida existe para devolver 160 pixels ao conteúdo, e o preço era
 * ficar sem saber onde clicar.
 *
 * Com o ícone, recolher deixa de custar informação: o desenho é a mesma pista
 * que estava ao lado do texto quando havia texto. É o único lugar do sistema
 * onde o ícone aparece sozinho — e por isso é o único que carrega `aria-label`
 * e dica ao passar o mouse.
 */
function ItemMenu({ rotulo, para, recolhido }) {
  const icone = ICONE_DA_TELA[para]
  // NavLink sabe sozinho se a rota atual é esta, e entrega isActive.
  return (
    <NavLink
      to={para}
      end={para === '/'}
      className="block"
      title={recolhido ? rotulo : undefined}
      aria-label={recolhido ? rotulo : undefined}
    >
      {({ isActive }) => (
        <div className="flex">
          {/* barra de acento à esquerda, visível só no item ativo */}
          <span className={`w-[3px] shrink-0 ${isActive ? 'bg-mate-500' : 'bg-transparent'}`} />
          <div
            className={`flex flex-1 items-center gap-2.5 py-2.5 ${recolhido ? 'justify-center px-0' : 'px-4'} ${
              isActive ? 'bg-barra-800' : ''
            }`}
          >
            <Icone
              de={icone}
              tamanho={TAMANHO.menu}
              className={isActive ? 'text-mate-500' : 'text-white/45'}
            />
            {!recolhido && (
              <span className={`truncate text-[13px] ${isActive ? 'font-semibold text-white' : 'text-white/60'}`}>
                {rotulo}
              </span>
            )}
          </div>
        </div>
      )}
    </NavLink>
  )
}

/**
 * Largura abaixo da qual o menu nasce recolhido.
 *
 * 1180 e não 1024: num notebook de 1366 o menu fica aberto e ainda sobram
 * mais de 1.100px de conteúdo, que é o que a tabela de pesagem precisa. Abaixo
 * de 1180 o conteúdo passa a valer mais que a legibilidade do menu — e recolher
 * devolve 160 pixels, que é a diferença entre ler a coluna de valor e não ler.
 */
const LARGURA_DE_RECOLHER = 1180

function useMenuRecolhido() {
  const [recolhido, setRecolhido] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < LARGURA_DE_RECOLHER
  )
  // Depois que a pessoa mexe no botão, a escolha dela manda: o automático só
  // vale enquanto ninguém decidiu nada. Um menu que reabre sozinho ao girar a
  // tela é das coisas mais irritantes que um sistema faz.
  const [decidiuNaMao, setDecidiuNaMao] = useState(false)

  useEffect(() => {
    if (decidiuNaMao) return
    function aoRedimensionar() {
      setRecolhido(window.innerWidth < LARGURA_DE_RECOLHER)
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [decidiuNaMao])

  function alternar() {
    setDecidiuNaMao(true)
    setRecolhido((r) => !r)
  }

  return { recolhido, alternar }
}

export default function Layout() {
  const { usuario, sair, podeFazer, ehAdministrador } = useAutenticacao()
  const navegar = useNavigate()
  const local = useLocation()
  const { recolhido, alternar } = useMenuRecolhido()

  // O nó onde o título da página vai ser desenhado. Criado uma vez, na
  // primeira montagem, e entregue às páginas por contexto — ver lib/cabecalho.js.
  const [noDoCabecalho] = useState(() => {
    if (typeof document === 'undefined') return null
    const no = document.createElement('div')
    no.className = 'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1'
    return no
  })

  // O menu mostra o que o servidor entrega para este perfil. A lista das telas
  // e o perfil que cada rota exige estão em lib/acesso.js; a decisão continua
  // sendo do middleware de autorização, no servidor.
  //
  // Esconder o item é conveniência de navegação: digitar /pagamentos na barra
  // de endereços leva a uma tela que não carrega nada, porque a API responde
  // 403. É o 403 que protege, não o menu.
  const secoes = secoesVisiveis({ podeFazer, ehAdministrador })

  const larguraDoMenu = recolhido ? 'w-[52px]' : 'w-[212px]'

  const iniciais = (usuario?.nome || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  function encerrar() {
    sair()
    navegar('/login')
  }

  return (
    <ContextoDoCabecalho.Provider value={noDoCabecalho}>
    <div className="flex h-screen flex-col">
      {/* ------------------------- barra superior -------------------------
          O `data-fora-da-impressao` saiu DAQUI e foi para cada controle. A
          diferença importa: com ele no <header>, imprimir um relatório saía
          sem título nenhum, porque o título agora mora aqui. Marcando peça por
          peça, o papel recebe o nome da tela e o período — que é justamente o
          cabeçalho que um relatório impresso precisa ter — e não recebe o
          botão do menu nem o nome de quem estava logado. */}
      <header className="flex h-[58px] shrink-0 items-center border-b border-borda bg-white pr-3 md:pr-5 print:h-auto print:border-b-2 print:pl-0">
        <div
          data-fora-da-impressao
          className={`flex h-full shrink-0 items-center gap-2.5 bg-barra-900 ${larguraDoMenu} ${
            recolhido ? 'justify-center px-0' : 'px-5'
          }`}
        >
          {/* 34 e não 24: a coroa tem dezesseis folhas e o miolo tem uma
              letra, e abaixo de uns 30 pixels isso vira mancha. A placa clara
              existe porque o corpo da engrenagem é quase a cor deste fundo —
              sem ela, some a engrenagem e some o M. */}
          <Marca sobreEscuro className="h-[34px] w-[34px]" />
          {!recolhido && (
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wider text-white">MATECH</span>
              <span className="block text-[8px] font-medium text-white/50">gestão de matéria-prima</span>
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 pl-3 md:gap-4 md:pl-5 print:pl-0">
          <button
            data-fora-da-impressao
            onClick={alternar}
            title={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
            aria-label={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[3px] border border-borda text-cinza-600 hover:border-mate-500 hover:text-mate-700"
          >
            {/* Três traços, o do meio mais curto quando recolhido — a seta
                aponta para o que vai acontecer, não para o estado atual. */}
            <span className="flex flex-col gap-[3px]">
              <span className="block h-[1.5px] w-[13px] bg-current" />
              <span className={`block h-[1.5px] bg-current ${recolhido ? 'w-[8px]' : 'w-[13px]'}`} />
              <span className="block h-[1.5px] w-[13px] bg-current" />
            </span>
          </button>

          {/* O TÍTULO DA PÁGINA ENTRA AQUI.
              O nó é preenchido por <CabecalhoPagina>, de dentro de cada
              página, através de um portal. Vazio quando a tela não declara
              título — e vazio ele não ocupa nada. */}
          <div
            className="flex min-w-0 flex-1 items-center"
            ref={(el) => { if (el && noDoCabecalho && !el.contains(noDoCabecalho)) el.appendChild(noDoCabecalho) }}
          />

          {/* O período some primeiro quando aperta: é contexto, não comando.
              Agora some antes de xl, e não de lg: o título e os botões da
              página passaram a dividir esta faixa com ele. */}
          <div className="hidden shrink-0 items-center gap-2 rounded-[3px] border border-borda bg-cabecalho px-2.5 py-1.5 xl:flex print:flex print:border-0 print:bg-transparent print:px-0">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">Período</span>
            <span className="whitespace-nowrap text-xs font-semibold text-tinta">{hoje}</span>
          </div>

          <button
            data-fora-da-impressao
            onClick={encerrar}
            className="flex shrink-0 items-center gap-2.5 border-l border-borda pl-3 md:pl-4"
            title="Sair do sistema"
          >
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] bg-mate-100 text-[11px] font-bold text-mate-700">
              {iniciais}
            </span>
            {/* Nome e perfil somem em tela estreita; as iniciais bastam para
                saber quem está logado, e o clique continua sendo o mesmo. */}
            <span className="hidden text-left leading-tight md:block">
              <span className="block max-w-[160px] truncate text-xs font-semibold text-tinta">
                {usuario?.nome}
              </span>
              <span className="block text-[10px] text-cinza-400">
                {NOME_PERFIL[usuario?.perfil] || usuario?.perfil}
              </span>
            </span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* -------------------------- menu lateral -------------------------- */}
        <nav
          data-fora-da-impressao
          className={`flex shrink-0 flex-col overflow-y-auto bg-barra-900 pb-4 pt-2 ${larguraDoMenu}`}
        >
          {secoes.map((grupo) => (
            <div key={grupo.secao}>
              {/* Recolhido, o título da seção vira um traço: some o texto, mas
                  fica a divisão — sem ela os itens viram uma coluna de pontos
                  indistinguíveis. */}
              {recolhido ? (
                <div className="mx-auto my-2 h-px w-5 bg-white/15" />
              ) : (
                <p className="px-4 pb-1.5 pt-4 text-[9px] font-semibold tracking-wider text-white/35">
                  {grupo.secao}
                </p>
              )}
              {grupo.itens.map((i) => (
                <ItemMenu key={i.para} {...i} recolhido={recolhido} />
              ))}
            </div>
          ))}
          <div className="flex-1" />
          <ItemMenu rotulo="Configurações" para="/configuracoes" recolhido={recolhido} />
        </nav>

        {/* ------------------------ área de conteúdo ------------------------ */}
        {/* O respiro encolhe junto com a tela: 24px numa estação de trabalho,
            12px num notebook apertado. Em software de operação, margem é a
            primeira coisa que cede — a tabela é que precisa caber. */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-fundo p-3 md:p-4 xl:p-5">
          {/* A chave é o endereço: trocar de tela recria o limite e limpa um
              erro que ficou para trás. Sem isso, uma tela que quebrou deixaria
              a mensagem de erro presa mesmo depois de navegar para outra. */}
          <LimiteDeErro key={local.pathname}>
            <Outlet />
          </LimiteDeErro>
        </main>
      </div>
    </div>
    </ContextoDoCabecalho.Provider>
  )
}

/**
 * Cabeçalho padrão de página: título, contexto curto e botões à direita.
 *
 * O `subtitulo` é EXCEÇÃO, não regra. Ele serve para dizer sobre que recorte a
 * tela está falando agora — o período de um relatório, quantas ordens estão em
 * aberto — e não para explicar o que a tela faz. Quem trabalha aqui todo dia
 * já sabe; ler de novo, toda vez, só custa uma linha de tela.
 */
export function CabecalhoPagina({ titulo, subtitulo, children }) {
  const no = useNoDoCabecalho()

  const conteudo = (
    <>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold leading-tight text-tinta xl:text-base">{titulo}</h1>
        {subtitulo && <p className="truncate text-[11px] leading-tight text-cinza-600">{subtitulo}</p>}
      </div>
      {children && (
        <div data-fora-da-impressao className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      )}
    </>
  )

  // Sem nó, desenha no lugar antigo. Não é caso hipotético: o Login fica fora
  // da moldura, e uma tela que quebrasse o portal deve continuar mostrando o
  // próprio título em vez de sumir com ele.
  if (!no) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">{conteudo}</div>
    )
  }
  return createPortal(conteudo, no)
}
