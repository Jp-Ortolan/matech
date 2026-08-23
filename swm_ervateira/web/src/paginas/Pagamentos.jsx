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
import { Painel, Tabela, Indicador, Situacao, Campo, Selecao, Botao, Carregando, Erro, Aviso, formatar } from '../componentes/ui'

export default function Pagamentos() {
  const { podeFazer } = useAutenticacao()

  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erroProdutores, setErroProdutores] = useState(null)

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
  const pagas = ordens.filter((o) => o.situacao === 'PAGA')

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
        subtitulo={`Agrupar as cargas analisadas em ordens e dar baixa · ${pendentes.length} em aberto`}
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
      <div className="mb-3 flex max-w-[320px] gap-2 xl:mb-4 xl:gap-3">
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
            O formulário de emissão está sem opções — isto é falha de carregamento, não ausência de cadastro.
          </Aviso>
        </div>
      )}

      <Painel titulo="Ordens emitidas" acao={carregando ? 'buscando...' : `${ordens.length} no total`}>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[
              { chave: 'numero', titulo: 'Ordem', forte: true },
              { chave: 'produtor', titulo: 'Produtor', forte: true, render: (o) => o.produtor?.nome },
              {
                chave: 'periodo', titulo: 'Período',
                render: (o) => `${formatar.data(o.periodoInicio)} a ${formatar.data(o.periodoFim)}`,
              },
              { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (o) => o._count?.itens ?? '—' },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (o) => formatar.reais(o.valorTotal) },
              {
                chave: 'pix', titulo: 'Pagar para',
                render: (o) => o.chavePixSnapshot
                  ? <span className="tabular">{o.chavePixSnapshot}</span>
                  : <span className="text-cinza-400">chave não informada</span>,
              },
              { chave: 'situacao', titulo: 'Situação', render: (o) => <Situacao valor={o.situacao} /> },
              {
                chave: 'acao', titulo: '',
                render: (o) =>
                  o.situacao === 'PENDENTE' && podeFazer('ADMINISTRATIVO') ? (
                    <button onClick={() => confirmar(o.id)}
                            className="text-[11px] font-semibold text-mate-700 hover:underline">
                      marcar como paga
                    </button>
                  ) : null,
              },
            ]}
            dados={ordens}
            vazio="Nenhuma ordem emitida ainda. Gere a primeira a partir das cargas analisadas."
          />
        )}
      </Painel>
    </>
  )
}

// ---------------------------------------------------------------------------
// Formulário de emissão
// ---------------------------------------------------------------------------
// Só entram cargas com situação ANALISADA e que ainda não estejam em outra
// ordem. Essa checagem acontece no servidor, não aqui — se sobrar zero carga,
// a API recusa com uma mensagem clara e a tela apenas a exibe.

function FormularioOrdem({ produtores, aoGerar }) {
  const hoje = new Date()
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const iso = (d) => d.toISOString().slice(0, 10)

  const [form, setForm] = useState({
    produtorId: '',
    periodoInicio: iso(primeiroDia),
    periodoFim: iso(hoje),
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await apiPagamentos.gerar(form)
      aoGerar()
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Gerar ordem do período" acao="agrupa as cargas analisadas e ainda não pagas" className="mb-3">
      <form onSubmit={enviar} className="flex flex-col gap-3 px-4 py-4">
        <Erro erro={erro} />
        <div className="flex items-end gap-3">
          <Selecao rotulo="Produtor" className="flex-1" required
                   value={form.produtorId}
                   onChange={(e) => setForm((f) => ({ ...f, produtorId: e.target.value }))}>
            <option value="">Selecione o produtor</option>
            {produtores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Selecao>
          <Campo rotulo="De" type="date" className="flex-1" required
                 value={form.periodoInicio}
                 onChange={(e) => setForm((f) => ({ ...f, periodoInicio: e.target.value }))} />
          <Campo rotulo="Até" type="date" className="flex-1" required
                 value={form.periodoFim}
                 onChange={(e) => setForm((f) => ({ ...f, periodoFim: e.target.value }))} />
          <Botao variante="primario" type="submit" disabled={enviando}>
            {enviando ? 'Gerando...' : 'Gerar ordem'}
          </Botao>
        </div>
        <p className="text-[10.5px] text-cinza-400">
          A chave Pix é copiada para a ordem no momento da emissão. Se o produtor
          trocar de chave depois, a ordem antiga continua mostrando para onde o
          dinheiro realmente foi.
        </p>
      </form>
    </Painel>
  )
}
