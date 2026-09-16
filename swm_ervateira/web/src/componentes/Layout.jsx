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

function ItemMenu({ rotulo, para, recolhido }) {
  const icone = ICONE_DA_TELA[para]
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
          <span className={`w-[3px] shrink-0 ${isActive ? 'bg-mate-700' : 'bg-transparent'}`} />
          <div
            className={`flex flex-1 items-center gap-2.5 py-2.5 ${recolhido ? 'justify-center px-0' : 'px-4'} ${
              isActive ? 'bg-mate-700' : 'hover:bg-barra-800'
            }`}
          >
            <Icone
              de={icone}
              tamanho={TAMANHO.menu}
              className={isActive ? 'text-white' : 'text-barra-tenue'}
            />
            {!recolhido && (
              <span className={`truncate text-[13px] ${isActive ? 'font-semibold text-white' : 'text-barra-tinta'}`}>
                {rotulo}
              </span>
            )}
          </div>
        </div>
      )}
    </NavLink>
  )
}

const LARGURA_DE_RECOLHER = 1180

function useMenuRecolhido() {
  const [recolhido, setRecolhido] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < LARGURA_DE_RECOLHER
  )
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

  const [noDoCabecalho] = useState(() => {
    if (typeof document === 'undefined') return null
    const no = document.createElement('div')
    no.className = 'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1'
    return no
  })

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
      <header className="flex h-[58px] shrink-0 items-center border-b border-borda bg-white pr-3 md:pr-5 print:h-auto print:border-b-2 print:pl-0">
        <div
          data-fora-da-impressao
          className={`flex h-full shrink-0 items-center gap-2.5 border-r border-barra-borda bg-barra-900 ${larguraDoMenu} ${
            recolhido ? 'justify-center px-0' : 'px-5'
          }`}
        >
          <Marca className="h-[34px] w-[34px]" />
          {!recolhido && (
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wider text-barra-tinta">MATECH</span>
              <span className="block text-[8px] font-medium text-barra-tenue">gestão de matéria-prima</span>
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
            <span className="flex flex-col gap-[3px]">
              <span className="block h-[1.5px] w-[13px] bg-current" />
              <span className={`block h-[1.5px] bg-current ${recolhido ? 'w-[8px]' : 'w-[13px]'}`} />
              <span className="block h-[1.5px] w-[13px] bg-current" />
            </span>
          </button>

          <div
            className="flex min-w-0 flex-1 items-center"
            ref={(el) => { if (el && noDoCabecalho && !el.contains(noDoCabecalho)) el.appendChild(noDoCabecalho) }}
          />

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
        <nav
          data-fora-da-impressao
          className={`flex shrink-0 flex-col overflow-y-auto border-r border-barra-borda bg-barra-900 pb-4 pt-2 ${larguraDoMenu}`}
        >
          {secoes.map((grupo) => (
            <div key={grupo.secao}>
              {recolhido ? (
                <div className="mx-auto my-2 h-px w-5 bg-barra-borda" />
              ) : (
                <p className="px-4 pb-1.5 pt-4 text-[9px] font-semibold tracking-wider text-barra-tenue">
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

        <main className="min-w-0 flex-1 overflow-y-auto bg-fundo p-3 md:p-4 xl:p-5">
          <LimiteDeErro key={local.pathname}>
            <Outlet />
          </LimiteDeErro>
        </main>
      </div>
    </div>
    </ContextoDoCabecalho.Provider>
  )
}

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

  if (!no) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">{conteudo}</div>
    )
  }
  return createPortal(conteudo, no)
}
