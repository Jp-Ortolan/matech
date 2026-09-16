import { useEffect, useState, useCallback } from 'react'
import { pagamentos as apiPagamentos, produtores as apiProdutores } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { FaixaDeIndicadores, Painel, Filtros, Tabela, Indicador, Situacao, Campo, Selecao, Botao, Etiqueta, Vazio, Carregando, Erro, Aviso, Janela, LinhaDado } from '../componentes/ui'
import OrdemImpressa from '../componentes/OrdemImpressa'
import { descreverDestino } from '../lib/destino'
import { formatar, contagem } from '../lib/formatar'
import { ICONE_DA_ACAO, ICONE_DA_GRANDEZA, SITUACAO } from '../lib/icones'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

export default function Pagamentos() {
  const { podeFazer } = useAutenticacao()

  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erroProdutores, setErroProdutores] = useState(null)
  const [recorte, setRecorte] = useState({ situacao: '', produtorId: '' })
  const [fila, setFila] = useState(null)
  const [paraImprimir, setParaImprimir] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [inicialDoForm, setInicialDoForm] = useState(null)
  const [erroFila, setErroFila] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [lista, esperando] = await Promise.all([
        apiPagamentos.listar(),
        apiPagamentos.aguardando().then(
          (r) => ({ ok: r }),
          (e) => ({ falha: e })
        ),
      ])
      setDados(lista)
      setFila(esperando.ok ?? null)
      setErroFila(esperando.falha ?? null)
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscar() }, [buscar])
  useEffect(() => {
    apiProdutores
      .listar()
      .then((r) => { setListaProdutores(r.produtores); setErroProdutores(null) })
      .catch(setErroProdutores)
  }, [])

  const ordens = dados?.ordens ?? []
  const pendentes = ordens.filter((o) => o.situacao === 'PENDENTE')
  const visiveis = ordens.filter(
    (o) =>
      (!recorte.situacao || o.situacao === recorte.situacao) &&
      (!recorte.produtorId || o.produtorId === recorte.produtorId)
  )

  function precificar(grupo) {
    const hoje = new Date()
    const inicio = grupo.maisAntiga ? new Date(grupo.maisAntiga) : hoje
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    setInicialDoForm({
      produtorId: grupo.produtor.id,
      periodoInicio: iso(inicio),
      periodoFim: iso(hoje),
    })
    setMostrarForm(true)
  }

  async function confirmar(id) {
    try {
      await apiPagamentos.confirmar(id)
      buscar()
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Ordens de pagamento"
        subtitulo={pendentes.length ? `${pendentes.length} em aberto` : null}
      >
        {podeFazer('ADMINISTRATIVO') && (
          <Botao variante="primario" onClick={() => { setInicialDoForm(null); setMostrarForm((v) => !v) }}
            icone={mostrarForm ? ICONE_DA_ACAO.limpar : ICONE_DA_ACAO.registrar}>
            {mostrarForm ? 'Fechar' : 'Gerar ordem do período'}
          </Botao>
        )}
      </CabecalhoPagina>

      <FaixaDeIndicadores className="max-w-[280px]">
        <Indicador rotulo="Em aberto" icone={ICONE_DA_GRANDEZA.dinheiro}
                   valor={formatar.reais(dados?.totalEmAberto ?? 0)}
                   vazio={Number(dados?.totalEmAberto ?? 0) === 0 ? 'nenhuma ordem em aberto' : null}
                   apoio={pendentes.length ? contagem(pendentes.length, 'ordem aguardando', 'ordens aguardando') : null}
                   cor="text-alerta" />
      </FaixaDeIndicadores>

      {mostrarForm && (
        <FormularioOrdem
          key={inicialDoForm?.produtorId ?? -1}
          produtores={listaProdutores}
          inicial={inicialDoForm}
          aoGerar={(ordem) => {
            setMostrarForm(false)
            setInicialDoForm(null)
            buscar()
            if (ordem) setParaImprimir(ordem)
          }}
        />
      )}

      {podeFazer('ADMINISTRATIVO') && (
        <FilaDePrecificacao fila={fila} erro={erroFila} carregando={carregando} aoPrecificar={precificar} />
      )}

      <Erro erro={erro} />
      {erroProdutores && (
        <div className="mb-3">
          <Aviso tom="alerta">
            Não foi possível carregar a lista de produtores ({erroProdutores.message}).
            O formulário de emissão está sem opções.
          </Aviso>
        </div>
      )}

      <Filtros
        ativos={resumirFiltros(recorte, {
          produtorId: (v) => nomeNaLista(listaProdutores, v),
          situacao: (v) => SITUACAO[v]?.rotulo ?? v,
        })}
        aoRemover={(chave) => setRecorte((r) => ({ ...r, [chave]: '' }))}
        aoLimpar={() => setRecorte({ situacao: '', produtorId: '' })}
      >
        <Selecao rotulo="Produtor" className="flex-[2]" value={recorte.produtorId}
                 onChange={(e) => setRecorte((r) => ({ ...r, produtorId: e.target.value }))}>
          <option value="">Todos os produtores</option>
          {listaProdutores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
        <Selecao rotulo="Situação" className="flex-1" value={recorte.situacao}
                 onChange={(e) => setRecorte((r) => ({ ...r, situacao: e.target.value }))}>
          <option value="">Todas</option>
          <option value="PENDENTE">Em aberto</option>
          <option value="PAGA">Pagas</option>
          <option value="CANCELADA">Canceladas</option>
        </Selecao>
      </Filtros>

      <Painel titulo="Ordens emitidas" acao={carregando ? 'buscando...' : `${visiveis.length} de ${ordens.length}`}>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[
              { chave: 'numero', titulo: 'Ordem', forte: true },
              { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 200, render: (o) => o.produtor?.nome },
              {
                chave: 'periodo', titulo: 'Período', oculta: 'lg',
                render: (o) => `${formatar.data(o.periodoInicio)} a ${formatar.data(o.periodoFim)}`,
              },
              { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (o) => o._count?.itens ?? '—' },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (o) => formatar.reais(o.valorTotal) },
              {
                chave: 'pix', titulo: 'Pagar para', truncar: 220, oculta: 'xl',
                render: (o) => <span className="tabular">{descreverDestino(o)}</span>,
              },
              {
                chave: 'acao', titulo: '', alinhar: 'direita',
                render: (o) => (
                  o.situacao === 'PENDENTE' && podeFazer('ADMINISTRATIVO')
                    ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmar(o.id) }}
                        className="whitespace-nowrap text-[11px] font-semibold text-mate-700 hover:underline"
                      >
                        dar baixa
                      </button>
                    )
                    : null
                ),
              },
              { chave: 'situacao', titulo: 'Situação', fixar: 'direita', render: (o) => <Situacao valor={o.situacao} /> },
            ]}
            dados={visiveis}
            aoClicarLinha={(o) => setFicha(o)}
            linhaAtiva={ficha?.id}
            vazio={ordens.length ? 'Nenhuma ordem com esses filtros.' : 'Nenhuma ordem emitida ainda.'}
          />
        )}
      </Painel>

      {ficha && (
        <Janela
          titulo={`Ordem ${ficha.numero}`}
          subtitulo="Cargas, destino do pagamento e situação"
          aoFechar={() => setFicha(null)}
        >
          <FichaDaOrdem
            ordem={ficha}
            podeMovimentar={podeFazer('ADMINISTRATIVO')}
            aoImprimir={(o) => { setFicha(null); setParaImprimir(o) }}
            aoConfirmar={(o) => { setFicha(null); confirmar(o.id) }}
          />
        </Janela>
      )}

      {paraImprimir && (
        <OrdemImpressa ordem={paraImprimir} aoFechar={() => setParaImprimir(null)} />
      )}
    </>
  )
}

function FichaDaOrdem({ ordem, podeMovimentar, aoImprimir, aoConfirmar }) {
  const itens = ordem.itens ?? []
  const pesoTotal = itens.reduce((s, i) => s + Number(i.pesoLiquidoKg || 0), 0)

  return (
    <Painel titulo={ordem.numero} acao={<Situacao valor={ordem.situacao} />}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LinhaDado rotulo="Produtor" valor={ordem.produtor?.nome} />
          <LinhaDado
            rotulo="Período"
            valor={`${formatar.data(ordem.periodoInicio)} a ${formatar.data(ordem.periodoFim)}`}
          />
          <LinhaDado rotulo="Emitida em" valor={formatar.dataHora(ordem.emitidaEm)} />
          <LinhaDado rotulo="Pagar para" valor={descreverDestino(ordem)} />
        </div>

        <div className="rounded-[3px] bg-cabecalho px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">
            Cargas na ordem · {contagem(itens.length, 'carga', 'cargas')}
          </p>
          <div className="flex flex-col gap-1.5">
            {itens.map((i) => (
              <div key={i.id} className="flex items-baseline gap-2 text-[11.5px]">
                <span className="font-semibold tabular text-tinta">{i.carga?.numeroTicket}</span>
                <span className="flex-1 truncate text-cinza-600">
                  {formatar.materiaPrima(i.carga?.tipoMateriaPrima)}
                </span>
                <span className="tabular text-cinza-600">{formatar.kg(i.pesoLiquidoKg)}</span>
                <span className="w-[92px] text-right font-semibold tabular text-tinta">
                  {formatar.reais(i.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-[3px] bg-mate-100 px-3 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-mate-700">Total da ordem</p>
            <p className="text-xl font-bold tabular text-mate-700">{formatar.reais(ordem.valorTotal)}</p>
          </div>
          <LinhaDado rotulo="Peso somado" valor={formatar.kg(pesoTotal)} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-borda pt-3">
          <Botao onClick={() => aoImprimir(ordem)}>Imprimir via</Botao>
          {ordem.situacao === 'PENDENTE' && podeMovimentar && (
            <Botao variante="primario" onClick={() => aoConfirmar(ordem)}>
              Dar baixa no pagamento
            </Botao>
          )}
        </div>
      </div>
    </Painel>
  )
}

function FormularioOrdem({ produtores, inicial, aoGerar }) {
  const hoje = new Date()
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const iso = (d) => d.toISOString().slice(0, 10)

  const [form, setForm] = useState({
    produtorId: inicial?.produtorId ?? '',
    periodoInicio: inicial?.periodoInicio ?? iso(primeiroDia),
    periodoFim: inicial?.periodoFim ?? iso(hoje),
  })
  const [previa, setPrevia] = useState(null)
  const [precos, setPrecos] = useState({})       // cargaId → texto digitado
  const [precoParaTodas, setPrecoParaTodas] = useState('')
  const [erro, setErro] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [destino, setDestino] = useState(null)
  const [atualizarCadastro, setAtualizarCadastro] = useState(false)

  const produtorEscolhido = produtores.find((p) => p.id === form.produtorId)

  useEffect(() => {
    if (!produtorEscolhido) { setDestino(null); return }
    setDestino({
      formaPagamento: produtorEscolhido.formaPagamento || 'PIX',
      titularConta: produtorEscolhido.titularConta || produtorEscolhido.nome || '',
      tipoChavePix: produtorEscolhido.tipoChavePix || 'CPF',
      chavePix: produtorEscolhido.chavePix || '',
      banco: produtorEscolhido.banco || '',
      agencia: produtorEscolhido.agencia || '',
      conta: produtorEscolhido.conta || '',
      tipoConta: produtorEscolhido.tipoConta || 'CORRENTE',
    })
    setAtualizarCadastro(false)
  }, [produtorEscolhido])

  const destinoMudou = Boolean(
    destino && produtorEscolhido &&
    Object.keys(destino).some((c) => {
      const original = c === 'titularConta'
        ? (produtorEscolhido.titularConta || produtorEscolhido.nome || '')
        : (produtorEscolhido[c] || (c === 'formaPagamento' ? 'PIX' : c === 'tipoChavePix' ? 'CPF' : c === 'tipoConta' ? 'CORRENTE' : ''))
      return String(destino[c] ?? '') !== String(original ?? '')
    })
  )

  function alterarDestino(campo, valor) {
    setDestino((d) => ({ ...d, [campo]: valor }))
  }

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setPrevia(null)
    setPrecos({})
  }

  async function buscarPrevia(e) {
    e?.preventDefault?.()
    setErro(null)
    setBuscando(true)
    try {
      const r = await apiPagamentos.previa(form)
      setPrevia(r)
      setPrecos(
        Object.fromEntries(
          r.cargas.filter((c) => c.precoSugeridoKg != null)
            .map((c) => [c.id, String(c.precoSugeridoKg)])
        )
      )
    } catch (e) {
      setErro(e)
      setPrevia(null)
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    if (!inicial?.produtorId) return
    buscarPrevia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial?.produtorId])

  function aplicarATodas(valor) {
    setPrecoParaTodas(valor)
    if (valor === '') return
    setPrecos(Object.fromEntries((previa?.cargas ?? []).map((c) => [c.id, valor])))
  }

  function valorDa(carga) {
    const preco = Number(precos[carga.id])
    if (!Number.isFinite(preco) || preco <= 0) return null
    return Number(carga.pesoLiquidoKg) * preco
  }

  const cargas = previa?.cargas ?? []
  const totais = cargas.map(valorDa)
  const faltaPreco = totais.some((v) => v === null)
  const total = totais.reduce((s, v) => s + (v ?? 0), 0)

  async function emitir() {
    setErro(null)
    setEnviando(true)
    try {
      const ordem = await apiPagamentos.gerar({
        ...form,
        precos: cargas.map((c) => ({ cargaId: c.id, precoKg: Number(precos[c.id]) })),
        destino,
        atualizarCadastro,
      })
      aoGerar(ordem)
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Gerar ordem do período" className="mb-6">
      <div className="flex flex-col gap-3 px-4 py-4">
        <form onSubmit={buscarPrevia} className="flex flex-wrap items-end gap-2 xl:gap-2.5">
          <Selecao rotulo="Produtor" className="min-w-[220px] flex-[2]" required
                   value={form.produtorId}
                   onChange={(e) => alterar('produtorId', e.target.value)}>
            <option value="">Selecione o produtor</option>
            {produtores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Selecao>
          <Campo rotulo="De" type="date" className="flex-1" required
                 value={form.periodoInicio}
                 onChange={(e) => alterar('periodoInicio', e.target.value)} />
          <Campo rotulo="Até" type="date" className="flex-1" required
                 value={form.periodoFim}
                 onChange={(e) => alterar('periodoFim', e.target.value)} />
          <Botao variante={previa ? 'secundario' : 'primario'} type="submit" disabled={buscando || !form.produtorId} icone={ICONE_DA_ACAO.buscar}>
            {buscando ? 'Buscando...' : 'Buscar cargas'}
          </Botao>
        </form>

        <Erro erro={erro} />

        {previa && previa.total === 0 && (
          <Aviso tom="alerta">{previa.motivo}</Aviso>
        )}

        {previa && previa.total > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-2 border-t border-borda pt-3 xl:gap-2.5">
              <Campo
                rotulo="Preço por quilo para todas (R$)"
                className="min-w-[220px] flex-1"
                type="number" step="0.0001" min="0.0001"
                placeholder="preencha as cargas de uma vez"
                value={precoParaTodas}
                onChange={(e) => aplicarATodas(e.target.value)}
              />
              <span className="flex-[2] pb-2 text-[10.5px] text-cinza-400">
                Atalho para o caso comum, em que a entrega inteira foi acordada pelo mesmo
                valor. Ajuste carga a carga abaixo quando o acordo tiver sido diferente.
              </span>
            </div>

            <Tabela
              colunas={[
                { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
                { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.data(c.dataHora) },
                { chave: 'tipo', titulo: 'Matéria-prima', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
                { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
                {
                  chave: 'palito', titulo: 'Palito', alinhar: 'direita', oculta: 'lg',
                  render: (c) => formatar.porcento(c.palitoPercentual),
                },
                {
                  chave: 'preco', titulo: 'Preço por quilo', largura: '150px',
                  render: (c) => (
                    <input
                      type="number" step="0.0001" min="0.0001"
                      value={precos[c.id] ?? ''}
                      onChange={(e) => setPrecos((p) => ({ ...p, [c.id]: e.target.value }))}
                      className="w-[128px] rounded-[3px] border border-borda bg-white px-2 py-1 text-right text-[11.5px] tabular text-tinta outline-none focus:border-mate-500"
                    />
                  ),
                },
                {
                  chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true,
                  render: (c) => {
                    const v = valorDa(c)
                    return v === null
                      ? <span className="text-cinza-400">informe o preço</span>
                      : formatar.reais(v)
                  },
                },
              ]}
              dados={cargas}
              rodape={
                <>
                  <span>{contagem(cargas.length, 'carga', 'cargas')} no período</span>
                  <span className="text-[13px] font-bold tabular text-mate-700">
                    {formatar.reais(total)}
                  </span>
                </>
              }
            />

            <DestinoDoPagamento
              destino={destino}
              aoAlterar={alterarDestino}
              atualizarCadastro={atualizarCadastro}
              aoMarcar={setAtualizarCadastro}
              mudou={destinoMudou}
            />

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-borda pt-3">
              {faltaPreco && (
                <span className="flex-1 text-[10.5px] font-medium text-alerta">
                  Toda carga precisa de preço — é ele que define o valor final.
                </span>
              )}
              <Botao variante="primario" type="button" onClick={emitir} disabled={enviando || faltaPreco}>
                {enviando ? 'Emitindo...' : `Emitir ordem de ${formatar.reais(total)}`}
              </Botao>
            </div>
          </>
        )}
      </div>
    </Painel>
  )
}

function FilaDePrecificacao({ fila, erro, carregando, aoPrecificar }) {
  if (carregando) return <Painel titulo="Aguardando precificação"><Carregando /></Painel>
  if (erro) {
    return (
      <Painel className="mb-6" titulo="Aguardando precificação">
        <div className="px-4 py-3">
          <Aviso tom="alerta">
            Não foi possível carregar a fila de cargas aguardando precificação. Isto é uma
            falha de leitura, não uma fila vazia: pode haver carga esperando pagamento.
            {erro?.message ? ` (${erro.message})` : ''}
          </Aviso>
        </div>
      </Painel>
    )
  }
  if (!fila || fila.totalCargas === 0) {
    return (
      <Painel titulo="Aguardando precificação">
        <Vazio texto="Nenhuma carga analisada esperando ordem. Tudo que passou pelo laboratório já virou pagamento." />
      </Painel>
    )
  }

  return (
    <Painel
      className="mb-6"
      titulo="Aguardando precificação"
      acao={`${contagem(fila.totalCargas, 'carga', 'cargas')} · ${formatar.kg(fila.pesoTotal)}`}
    >
      <Tabela
        colunas={[
          { chave: 'nome', titulo: 'Produtor', forte: true, truncar: 200, render: (g) => g.produtor.nome },
          {
            chave: 'espera', titulo: 'Espera desde', oculta: 'lg',
            render: (g) => formatar.data(g.maisAntiga),
          },
          { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (g) => g.cargas.length },
          { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', render: (g) => formatar.kg(g.pesoTotal) },
          {
            chave: 'sugerido', titulo: 'Valor sugerido', alinhar: 'direita', forte: true,
            render: (g) => (g.valorSugerido ? formatar.reais(g.valorSugerido) : <span className="text-cinza-400">sem preço</span>),
          },
          {
            chave: 'acao', titulo: '', alinhar: 'direita',
            render: (g) => (
              <button
                onClick={() => aoPrecificar(g)}
                className="whitespace-nowrap text-[11px] font-semibold text-mate-700 hover:underline"
              >
                precificar e emitir
              </button>
            ),
          },
        ]}
        dados={fila.produtores}
        vazio="Nenhuma carga esperando."
      />
      <div className="border-t border-borda px-4 py-2.5">
        <p className="text-[10px] text-cinza-400">
          Entram aqui as cargas com análise lançada que ainda não estão em nenhuma ordem.
          Carga reprovada não gera pagamento e não aparece.
        </p>
      </div>
    </Painel>
  )
}

function DestinoDoPagamento({ destino, aoAlterar, atualizarCadastro, aoMarcar, mudou }) {
  if (!destino) return null
  const ehPix = destino.formaPagamento === 'PIX'
  const ehConta = destino.formaPagamento === 'CONTA_BANCARIA'

  return (
    <div className="rounded-[3px] border border-borda">
      <div className="flex items-center gap-2 border-b border-borda bg-cabecalho px-3 py-2">
        <p className="flex-1 text-[11px] font-semibold text-cinza-600">
          Para onde vai o pagamento
        </p>
        {mudou && <Etiqueta tom="alerta">diferente do cadastro</Etiqueta>}
      </div>

      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <Selecao
            rotulo="Forma"
            className="min-w-[160px] flex-1"
            value={destino.formaPagamento}
            onChange={(e) => aoAlterar('formaPagamento', e.target.value)}
          >
            <option value="PIX">Pix</option>
            <option value="CONTA_BANCARIA">Conta bancária</option>
            <option value="DINHEIRO">Dinheiro</option>
          </Selecao>
          <Campo
            rotulo="Titular"
            className="min-w-[200px] flex-[2]"
            value={destino.titularConta}
            onChange={(e) => aoAlterar('titularConta', e.target.value)}
          />
        </div>

        {ehPix && (
          <div className="flex flex-wrap items-end gap-2.5">
            <Selecao
              rotulo="Tipo da chave"
              className="min-w-[150px] flex-1"
              value={destino.tipoChavePix}
              onChange={(e) => aoAlterar('tipoChavePix', e.target.value)}
            >
              <option value="CPF">CPF</option>
              <option value="TELEFONE">Telefone</option>
              <option value="EMAIL">E-mail</option>
              <option value="ALEATORIA">Chave aleatória</option>
            </Selecao>
            <Campo
              rotulo="Chave Pix"
              className="min-w-[240px] flex-[2]"
              value={destino.chavePix}
              onChange={(e) => aoAlterar('chavePix', e.target.value)}
            />
          </div>
        )}

        {ehConta && (
          <div className="flex flex-wrap items-end gap-2.5">
            <Campo rotulo="Banco" className="min-w-[160px] flex-1" value={destino.banco}
                   onChange={(e) => aoAlterar('banco', e.target.value)} />
            <Campo rotulo="Agência" className="min-w-[110px] flex-1" value={destino.agencia}
                   onChange={(e) => aoAlterar('agencia', e.target.value)} />
            <Campo rotulo="Conta" className="min-w-[140px] flex-1" value={destino.conta}
                   onChange={(e) => aoAlterar('conta', e.target.value)} />
            <Selecao rotulo="Tipo" className="min-w-[130px] flex-1" value={destino.tipoConta}
                     onChange={(e) => aoAlterar('tipoConta', e.target.value)}>
              <option value="CORRENTE">Corrente</option>
              <option value="POUPANCA">Poupança</option>
            </Selecao>
          </div>
        )}

        {destino.formaPagamento === 'DINHEIRO' && (
          <p className="text-[10.5px] text-cinza-600">
            Pagamento em espécie, no balcão. A ordem sai sem destino bancário e serve de
            recibo do que foi apurado.
          </p>
        )}

        {mudou && (
          <label className="flex items-start gap-2 rounded-[3px] bg-alerta-bg px-3 py-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={atualizarCadastro}
              onChange={(e) => aoMarcar(e.target.checked)}
            />
            <span className="text-[10.5px] leading-relaxed text-alerta">
              Atualizar também o cadastro do produtor.
              Deixe desmarcado se a mudança vale só para esta ordem — a ordem guarda o
              destino de qualquer forma, e o cadastro fica como está.
            </span>
          </label>
        )}
      </div>
    </div>
  )
}
