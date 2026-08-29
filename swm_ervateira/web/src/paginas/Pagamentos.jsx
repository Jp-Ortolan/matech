// ---------------------------------------------------------------------------
// PÁGINA · ordens de pagamento
// ---------------------------------------------------------------------------
// Fecha o ciclo do sistema: as cargas já pesadas e analisadas de um produtor,
// num período, viram uma ordem única.
//
// Uma decisão de negócio que aparece na tela: o pagamento em si é feito no
// banco, fora do sistema. O MATECH exibe a chave Pix e registra que foi pago.
// Assumir a transferência exigiria integração bancária, homologação e
// responsabilidade sobre dinheiro — fora do escopo de um TCC.

import { useEffect, useState, useCallback } from 'react'
import { pagamentos as apiPagamentos, produtores as apiProdutores } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { Painel, Filtros, Tabela, Indicador, Situacao, Campo, Selecao, Botao, Carregando, Erro, Aviso } from '../componentes/ui'
import { formatar, contagem } from '../lib/formatar'

export default function Pagamentos() {
  const { podeFazer } = useAutenticacao()

  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erroProdutores, setErroProdutores] = useState(null)
  // Filtro do navegador: a rota devolve as ordens de uma vez, e voltar ao
  // servidor só para esconder linhas seria ida perdida.
  const [recorte, setRecorte] = useState({ situacao: '', produtorId: '' })

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await apiPagamentos.listar())
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscar() }, [buscar])
  // Esta lista alimenta o formulário de emissão. A falha precisa aparecer: sem
  // produtores no campo, o administrativo conclui que não há ninguém a pagar.
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
          <Botao variante="primario" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Fechar' : 'Gerar ordem do período'}
          </Botao>
        )}
      </CabecalhoPagina>

      {/* Um número só, e é o único que pede ação: quanto a empresa deve e
          ainda não pagou. O total pago e a contagem de ordens estão no
          Dashboard, e a lista abaixo mostra as duas coisas linha a linha. */}
      <div className="mb-3 flex max-w-[280px] gap-2">
        <Indicador rotulo="Em aberto" valor={formatar.reais(dados?.totalEmAberto ?? 0)}
                   apoio={`${pendentes.length} ordens aguardando`} cor="text-alerta" />
      </div>

      {mostrarForm && (
        <FormularioOrdem
          produtores={listaProdutores}
          aoGerar={() => { setMostrarForm(false); buscar() }}
        />
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

      <Filtros>
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
        <span className="flex-1" />
        <Botao onClick={() => setRecorte({ situacao: '', produtorId: '' })}>Limpar</Botao>
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
                // A chave é o que quem paga copia para o aplicativo do banco.
                // Fica na tabela por isso, e não por completude.
                chave: 'pix', titulo: 'Pagar para', truncar: 170,
                render: (o) => o.chavePixSnapshot
                  ? <span className="tabular">{o.chavePixSnapshot}</span>
                  : <span className="text-cinza-400">—</span>,
              },
              { chave: 'situacao', titulo: 'Situação', render: (o) => <Situacao valor={o.situacao} /> },
              {
                chave: 'acao', titulo: '', alinhar: 'direita',
                render: (o) =>
                  o.situacao === 'PENDENTE' && podeFazer('ADMINISTRATIVO') ? (
                    <button onClick={() => confirmar(o.id)}
                            className="whitespace-nowrap text-[11px] font-semibold text-mate-700 hover:underline">
                      dar baixa
                    </button>
                  ) : null,
              },
            ]}
            dados={visiveis}
            vazio={ordens.length ? 'Nenhuma ordem com esses filtros.' : 'Nenhuma ordem emitida ainda.'}
          />
        )}
      </Painel>
    </>
  )
}

// ---------------------------------------------------------------------------
// Emissão da ordem, em duas etapas
// ---------------------------------------------------------------------------
// É AQUI QUE O PREÇO ENTRA NO SISTEMA, e a tela tem duas etapas por causa
// disso: não dá para pedir preço antes de mostrar a que carga ele se refere.
//
//   1. produtor e período  →  a prévia lista as cargas elegíveis
//   2. um preço por carga  →  emite
//
// O preço é POR CARGA, e não um só para a ordem, porque é assim que a
// ervateira negocia. Um produtor pode entregar erva-mate e lenha no mesmo
// período, e os dois valem valores muito diferentes — um preço único
// produziria um número que não corresponde a nenhum acordo real.
//
// Quando não há nada elegível, a prévia diz POR QUÊ. Antes, a emissão
// simplesmente falhava com "nenhuma carga analisada e em aberto", sem
// distinguir entre falta de análise, período errado e carga já paga.

function FormularioOrdem({ produtores, aoGerar }) {
  const hoje = new Date()
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const iso = (d) => d.toISOString().slice(0, 10)

  const [form, setForm] = useState({
    produtorId: '',
    periodoInicio: iso(primeiroDia),
    periodoFim: iso(hoje),
  })
  const [previa, setPrevia] = useState(null)
  const [precos, setPrecos] = useState({})       // cargaId → texto digitado
  const [precoParaTodas, setPrecoParaTodas] = useState('')
  const [erro, setErro] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // Mudou o recorte: a prévia anterior não vale mais.
    setPrevia(null)
    setPrecos({})
  }

  async function buscarPrevia(e) {
    e.preventDefault()
    setErro(null)
    setBuscando(true)
    try {
      const r = await apiPagamentos.previa(form)
      setPrevia(r)
      // Preenche com o preço sugerido, quando a carga trouxe um — combinado no
      // campo ou digitado numa pesagem antiga. É ponto de partida, não decisão.
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

  function aplicarATodas(valor) {
    setPrecoParaTodas(valor)
    if (valor === '') return
    setPrecos(Object.fromEntries((previa?.cargas ?? []).map((c) => [c.id, valor])))
  }

  /** O valor de uma carga: o preço informado, menos o desconto que o laboratório mediu. */
  function valorDa(carga) {
    const preco = Number(precos[carga.id])
    if (!Number.isFinite(preco) || preco <= 0) return null
    const ajustado = preco * (1 - Number(carga.descontoPercentual) / 100)
    return Number(carga.pesoLiquidoKg) * ajustado
  }

  const cargas = previa?.cargas ?? []
  const totais = cargas.map(valorDa)
  const faltaPreco = totais.some((v) => v === null)
  const total = totais.reduce((s, v) => s + (v ?? 0), 0)

  async function emitir() {
    setErro(null)
    setEnviando(true)
    try {
      await apiPagamentos.gerar({
        ...form,
        precos: cargas.map((c) => ({ cargaId: c.id, precoKg: Number(precos[c.id]) })),
      })
      aoGerar()
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Gerar ordem do período" className="mb-3">
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
          <Botao variante={previa ? 'secundario' : 'primario'} type="submit" disabled={buscando || !form.produtorId}>
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
                  chave: 'desconto', titulo: 'Desconto', alinhar: 'direita',
                  render: (c) => Number(c.descontoPercentual) > 0
                    ? <span className="font-semibold text-perigo">−{formatar.porcento(c.descontoPercentual, 2)}</span>
                    : <span className="text-cinza-400">—</span>,
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
