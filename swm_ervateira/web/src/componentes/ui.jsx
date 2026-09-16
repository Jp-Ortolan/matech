import { useEffect, useRef, useState } from 'react'
import { TAMANHO, SITUACAO, ICONE_DA_ACAO } from '../lib/icones'
import { faixaDePaginas } from '../lib/paginacao'
import Marca from './Marca'

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

export function FaixaDeIndicadores({ children, className = '' }) {
  return (
    <div className={`mb-6 flex flex-wrap items-start gap-x-8 gap-y-5 ${className}`}>
      {children}
    </div>
  )
}

export function Indicador({ rotulo, valor, unidade, apoio, icone, vazio, cor = 'text-tinta' }) {
  return (
    <div className="min-w-[140px] flex-1">
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
        <Icone de={icone} tamanho={TAMANHO.indicador} />
        <span className="truncate">{rotulo}</span>
      </p>
      {vazio ? (
        <p className="mt-1.5 text-xs text-cinza-400">{vazio}</p>
      ) : (
        <p className={`mt-1.5 flex items-baseline gap-1.5 ${cor}`}>
          <span className="text-[26px] font-bold leading-none tabular">{valor}</span>
          {unidade && <span className="truncate text-[11px] font-medium text-cinza-400">{unidade}</span>}
        </p>
      )}
      {apoio && <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-cinza-600" title={apoio}>{apoio}</p>}
    </div>
  )
}

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

const OCULTAR_ABAIXO_DE = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

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

export function Filtros({ children, busca, ativos = [], aoRemover, aoLimpar }) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e) { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  const temPainel = Boolean(children)

  return (
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

export function Vazio({ texto = 'Nenhum registro encontrado' }) {
  return <p className="px-4 py-10 text-center text-xs text-cinza-400">{texto}</p>
}

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

export function Abas({ abas, ativa, aoTrocar }) {
  return (
    <div className="mb-3 flex gap-0 overflow-x-auto overflow-y-hidden border-b border-borda">
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

export function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8" role="status" aria-live="polite">
      <Marca girando className="h-9 w-9 opacity-90" />
      <p className="text-center text-xs text-cinza-400">{texto}</p>
    </div>
  )
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

export function Sucesso({ texto }) {
  if (!texto) return null
  return (
    <div className="rounded-[3px] border border-mate-100 bg-mate-100 px-3 py-2.5">
      <p className="text-[11.5px] font-semibold text-mate-700">{texto}</p>
    </div>
  )
}

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

export function Janela({ titulo, subtitulo, acao, largura = 820, aoFechar, children }) {
  const fundo = useRef(null)
  const alvoDoAperto = useRef(null)
  const painel = useRef(null)

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)

    document.body.setAttribute('data-janela-aberta', '')

    painel.current?.focus()

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.removeAttribute('data-janela-aberta')
    }
  }, [aoFechar])

  return (
    <div
      ref={fundo}
      data-fora-da-impressao
      onMouseDown={(e) => { alvoDoAperto.current = e.target }}
      onMouseUp={(e) => {
        if (e.target === fundo.current && alvoDoAperto.current === fundo.current) aoFechar()
      }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-tinta/45 p-3 md:p-6 lg:p-10"
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        style={{ maxWidth: largura }}
        className="flex max-h-full w-full flex-col rounded-[3px] border border-borda bg-white shadow-[0_10px_40px_rgba(31,36,34,.25)] outline-none"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-borda px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold text-tinta">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 truncate text-[11px] text-cinza-600">{subtitulo}</p>}
          </div>
          {acao}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-cinza-400 hover:bg-cabecalho hover:text-tinta"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-fundo p-3 md:p-4">{children}</div>
      </div>
    </div>
  )
}
