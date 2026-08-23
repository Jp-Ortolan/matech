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
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAutenticacao, NOME_PERFIL } from '../contexto/Autenticacao'

const MENU = [
  {
    secao: 'OPERAÇÃO',
    itens: [
      { rotulo: 'Dashboard', para: '/' },
      { rotulo: 'Pesagem', para: '/pesagem' },
      { rotulo: 'Avaliações', para: '/avaliacoes' },
    ],
  },
  {
    // Seção própria, e não um item solto em OPERAÇÃO, porque o que vem do
    // aplicativo tem uma natureza diferente do resto: não foi digitado aqui,
    // chegou de fora, e pode estar a caminho. Agrupar as duas telas deixa
    // isso legível no próprio menu.
    secao: 'CAMPO',
    itens: [
      { rotulo: 'Avaliações de campo', para: '/campo' },
      { rotulo: 'Sincronização', para: '/sincronizacao' },
    ],
  },
  {
    secao: 'CADASTROS',
    itens: [
      { rotulo: 'Produtores', para: '/produtores' },
      { rotulo: 'Matéria-prima', para: '/materia-prima' },
    ],
  },
  {
    secao: 'FINANCEIRO',
    itens: [
      { rotulo: 'Pagamentos', para: '/pagamentos' },
      { rotulo: 'Relatórios', para: '/relatorios' },
    ],
  },
]

function ItemMenu({ rotulo, para, recolhido }) {
  // NavLink sabe sozinho se a rota atual é esta, e entrega isActive.
  return (
    <NavLink
      to={para}
      end={para === '/'}
      className="block"
      // Recolhido, o rótulo some e só sobra o marcador — então o título do
      // navegador passa a ser a única pista do que é cada item.
      title={recolhido ? rotulo : undefined}
    >
      {({ isActive }) => (
        <div className="flex">
          {/* barra de acento à esquerda, visível só no item ativo */}
          <span className={`w-[3px] shrink-0 ${isActive ? 'bg-mate-500' : 'bg-transparent'}`} />
          <div
            className={`flex flex-1 items-center gap-3 py-2.5 ${recolhido ? 'justify-center px-0' : 'px-4'} ${
              isActive ? 'bg-mate-800' : ''
            }`}
          >
            <span className={`h-[7px] w-[7px] shrink-0 rounded-[1px] ${isActive ? 'bg-mate-500' : 'bg-white/20'}`} />
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
 * 1180 e não 1024: com o menu aberto sobram 950px de conteúdo, que é o mínimo
 * para a tabela de recebimento caber sem rolagem lateral. Abaixo disso o
 * conteúdo passa a valer mais que a legibilidade do menu — e recolher devolve
 * 180 pixels, que é a diferença entre ler a coluna de valor e não ler.
 */
const LARGURA_DE_RECOLHER = 1180

function usarMenuRecolhido() {
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
  const { usuario, sair } = useAutenticacao()
  const navegar = useNavigate()
  const { recolhido, alternar } = usarMenuRecolhido()

  const larguraDoMenu = recolhido ? 'w-[52px]' : 'w-[232px]'

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
    <div className="flex h-screen flex-col">
      {/* ------------------------- barra superior ------------------------- */}
      <header data-fora-da-impressao className="flex h-[58px] shrink-0 items-center border-b border-borda bg-white pr-3 md:pr-5">
        <div
          className={`flex h-full shrink-0 items-center gap-2.5 bg-mate-900 ${larguraDoMenu} ${
            recolhido ? 'justify-center px-0' : 'px-5'
          }`}
        >
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] bg-mate-500 text-sm font-bold text-white">
            M
          </span>
          {!recolhido && (
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wider text-white">MATECH</span>
              <span className="block text-[8px] font-medium text-white/50">gestão de matéria-prima</span>
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 pl-3 md:gap-4 md:pl-5">
          <button
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

          {/* O período some primeiro quando aperta: é contexto, não comando. */}
          <div className="hidden items-center gap-2 rounded-[3px] border border-borda bg-cabecalho px-2.5 py-1.5 lg:flex">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">Período</span>
            <span className="whitespace-nowrap text-xs font-semibold text-tinta">{hoje}</span>
          </div>

          <div className="min-w-0 flex-1" />

          <button
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
          className={`flex shrink-0 flex-col overflow-y-auto bg-mate-900 pb-4 pt-2 ${larguraDoMenu}`}
        >
          {MENU.map((grupo) => (
            <div key={grupo.secao}>
              {/* Recolhido, o título da seção vira um traço: some o texto, mas
                  fica a divisão — sem ela os itens viram uma coluna de pontos
                  indistinguíveis. */}
              {recolhido ? (
                <div className="mx-auto my-2 h-px w-5 bg-white/15" />
              ) : (
                <p className="px-5 pb-1.5 pt-4 text-[9px] font-semibold tracking-wider text-white/35">
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
          {!recolhido && (
            <p className="px-5 pt-3 text-[9px] text-white/25">MATECH v0.4 · base local</p>
          )}
        </nav>

        {/* ------------------------ área de conteúdo ------------------------ */}
        {/* O respiro encolhe junto com a tela: 24px numa estação de trabalho,
            12px num notebook apertado. Em software de operação, margem é a
            primeira coisa que cede — a tabela é que precisa caber. */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-fundo p-3 md:p-4 xl:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Cabeçalho padrão de página: título, subtítulo e botões à direita. */
export function CabecalhoPagina({ titulo, subtitulo, children }) {
  return (
    // flex-wrap e não grid: com um botão só, ele fica ao lado do título;
    // com três, eles descem para uma segunda linha sozinhos, sem breakpoint.
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 xl:mb-4">
      <div className="min-w-[200px] flex-1">
        <h1 className="text-lg font-bold text-tinta xl:text-xl">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-[11px] text-cinza-600">{subtitulo}</p>}
      </div>
      {children}
    </div>
  )
}
