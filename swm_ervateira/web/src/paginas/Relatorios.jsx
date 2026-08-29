// ---------------------------------------------------------------------------
// PÁGINA · relatórios  (RF12 a RF14)
// ---------------------------------------------------------------------------
// Quatro recortes dos mesmos dados, escolhidos por aba. Um filtro só, no topo,
// vale para os quatro — o usuário define o período uma vez e troca a pergunta,
// em vez de refazer o filtro a cada relatório.
//
// POR QUE OS NÚMEROS SÃO CALCULADOS AQUI, E NÃO EM UMA ROTA DE RELATÓRIO:
// a API já devolve as cargas do período com produtor, análise e situação
// dentro. Criar rotas /api/relatorios/* significaria escrever pela segunda vez
// somas que a tela já sabe fazer — e duas versões da mesma conta divergem.
// Quando o volume crescer a ponto de a soma no navegador pesar, a conta migra
// para o banco em uma consulta agregada; enquanto isso, uma fonte só.
//
// A quarta aba é a mais importante para o trabalho escrito: ela compara o peso
// ESTIMADO em campo pelo avaliador com o peso REAL medido na balança. É o
// indicador de acurácia da avaliação em campo do Quadro 9, e só existe porque
// a carga guarda pesoEstimadoCampoKg junto com o peso pesado.

import { useEffect, useState, useCallback } from 'react'
import {
  cargas as apiCargas,
  pagamentos as apiPagamentos,
  produtores as apiProdutores,
} from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, SaidaDoPainel, Tabela, Indicador, Situacao, Campo, Selecao, Botao, Abas, Barra,
  Carregando, Erro, Vazio, Etiqueta, Aviso, formatar,
} from '../componentes/ui'
import { useAutenticacao } from '../contexto/Autenticacao'
import { baixarCsv, numeroCsv } from '../lib/exportar'
import { LIMITE_PALITO_PADRAO } from '../lib/calculo'

// A aba financeira só existe para quem pode ler ordens de pagamento. Não é
// uma regra desta tela: GET /api/pagamentos exige o perfil, e sem ele a aba
// abriria vazia com 403 no console.
const ABAS = [
  { id: 'recebimento', rotulo: 'Recebimento' },
  { id: 'qualidade', rotulo: 'Qualidade' },
  { id: 'financeiro', rotulo: 'Financeiro', exigeDinheiro: true },
  { id: 'acuracia', rotulo: 'Acurácia da estimativa' },
]

export default function Relatorios() {
  const { podeFazer } = useAutenticacao()
  const veDinheiro = podeFazer('ADMINISTRATIVO')
  const abas = ABAS.filter((a) => !a.exigeDinheiro || veDinheiro)

  const [filtros, setFiltros] = useState({ de: '', ate: '', produtorId: '' })
  const [aba, setAba] = useState('recebimento')

  const [lista, setLista] = useState([])
  const [ordens, setOrdens] = useState([])
  const [listaProdutores, setListaProdutores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [erroProdutores, setErroProdutores] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // As duas consultas saem juntas: são independentes uma da outra, então
      // esperar a primeira para só depois pedir a segunda dobraria a espera.
      const [c, p] = await Promise.all([
        apiCargas.listar({ ...filtros, porPagina: 500 }),
        veDinheiro ? apiPagamentos.listar({ produtorId: filtros.produtorId }) : Promise.resolve(null),
      ])
      setLista(c.cargas)
      setOrdens(p ? recortarPorPeriodo(p.ordens, filtros) : [])
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [filtros, veDinheiro])

  useEffect(() => { buscar() }, [buscar])

  // O filtro por produtor depende desta lista. Engolir a falha faria o relatório
  // parecer completo enquanto o filtro estivesse mudo.
  useEffect(() => {
    apiProdutores
      .listar()
      .then((r) => { setListaProdutores(r.produtores); setErroProdutores(null) })
      .catch(setErroProdutores)
  }, [])

  const nomeProdutor = listaProdutores.find((p) => p.id === filtros.produtorId)?.nome
  const periodo = filtros.de || filtros.ate
    ? `${filtros.de ? formatar.data(filtros.de) : 'início'} a ${filtros.ate ? formatar.data(filtros.ate) : 'hoje'}`
    : 'todo o histórico'

  return (
    <>
      <CabecalhoPagina
        titulo="Relatórios"
        subtitulo={`${periodo}${nomeProdutor ? ` · ${nomeProdutor}` : ''}`}
      />

      <Filtros>
        <Campo rotulo="De" type="date" className="flex-1" value={filtros.de}
               onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
        <Campo rotulo="Até" type="date" className="flex-1" value={filtros.ate}
               onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        <Selecao rotulo="Produtor" className="flex-[2]" value={filtros.produtorId}
                 onChange={(e) => setFiltros((f) => ({ ...f, produtorId: e.target.value }))}>
          <option value="">Todos os produtores</option>
          {listaProdutores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
        <Botao onClick={() => setFiltros({ de: '', ate: '', produtorId: '' })}>Limpar</Botao>
      </Filtros>

      <Abas abas={abas} ativa={aba} aoTrocar={setAba} />

      <Erro erro={erro} />
      {erroProdutores && (
        <div className="mb-3">
          <Aviso tom="alerta">
            Não foi possível carregar a lista de produtores ({erroProdutores.message}).
            O filtro por produtor está sem opções.
          </Aviso>
        </div>
      )}

      {carregando ? (
        <Painel titulo="Apurando"><Carregando texto="Apurando os números do período..." /></Painel>
      ) : (
        <>
          {aba === 'recebimento' && <Recebimento lista={lista} />}
          {aba === 'qualidade' && <Qualidade lista={lista} />}
          {aba === 'financeiro' && veDinheiro && <Financeiro ordens={ordens} />}
          {aba === 'acuracia' && <Acuracia lista={lista} />}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// ABA 1 · recebimento
// ---------------------------------------------------------------------------

function Recebimento({ lista }) {
  const peso = somar(lista, (c) => c.pesoLiquidoKg)
  const bruto = somar(lista, (c) => c.pesoBrutoKg)
  const tara = somar(lista, (c) => c.taraKg)
  const porProdutor = agrupar(lista, (c) => c.produtor?.nome || 'sem produtor')
  const porTipo = agrupar(lista, (c) => formatar.materiaPrima(c.tipoMateriaPrima))
  const porDia = agrupar(lista, (c) => formatar.chaveDoDia(c.dataHora))
  const maiorProdutor = Math.max(1, ...porProdutor.map((g) => g.peso))
  const maiorDia = Math.max(1, ...porDia.map((g) => g.peso))

  if (!lista.length) {
    return <Painel titulo="Recebimento"><Vazio texto="Nenhuma carga registrada no período selecionado." /></Painel>
  }

  function exportar() {
    baixarCsv(
      'matech-recebimento',
      ['Ticket', 'Data', 'Produtor', 'Matéria-prima', 'Motorista', 'Placa',
       'Peso bruto (kg)', 'Tara (kg)', 'Peso líquido (kg)', 'Preço base (R$/kg)',
       'Preço ajustado (R$/kg)', 'Valor (R$)', 'Situação'],
      lista.map((c) => [
        c.numeroTicket,
        formatar.dataHora(c.dataHora),
        c.produtor?.nome,
        formatar.materiaPrima(c.tipoMateriaPrima),
        c.motorista?.nome || '',
        c.veiculo?.placa || '',
        numeroCsv(c.pesoBrutoKg),
        numeroCsv(c.taraKg),
        numeroCsv(c.pesoLiquidoKg),
        numeroCsv(c.precoBaseKg, 4),
        numeroCsv(c.analise?.precoAjustadoKg, 4),
        numeroCsv(c.analise?.valorTotal),
        c.situacao,
      ])
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Indicador rotulo="Peso líquido recebido" valor={formatar.numero(peso)} unidade="kg"
                   apoio={`${lista.length} cargas`} cor="text-mate-700" />
        <Indicador rotulo="Média por carga" valor={formatar.numero(peso / lista.length)} unidade="kg"
                   apoio="peso líquido médio" />
        <Indicador rotulo="Tara descontada" valor={formatar.numero(tara)} unidade="kg"
                   apoio={`${formatar.porcento((tara / bruto) * 100)} do peso bruto`} />
        <Indicador rotulo="Produtores atendidos" valor={porProdutor.length} unidade="produtores"
                   apoio="com entrega no período" />
      </div>

      <div className="mb-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_360px]">
        <Painel titulo="Recebimento por produtor" acao={`${porProdutor.length} produtores`}>
          <Tabela
            colunas={[
              { chave: 'chave', titulo: 'Produtor', forte: true, truncar: 240 },
              { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita' },
              { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (g) => formatar.kg(g.peso) },
              { chave: 'part', titulo: 'Part.', alinhar: 'direita', render: (g) => formatar.porcento((g.peso / peso) * 100) },
              { chave: 'valor', titulo: 'Valor analisado', alinhar: 'direita', forte: true, render: (g) => (g.valor ? formatar.reais(g.valor) : '—') },
              {
                chave: 'barra', titulo: '', largura: '120px', oculta: 'xl',
                render: (g) => (
                  <div className="h-[7px] w-full bg-cabecalho">
                    <div className="h-full bg-mate-500" style={{ width: `${(g.peso / maiorProdutor) * 100}%` }} />
                  </div>
                ),
              },
            ]}
            dados={porProdutor}
            rodape={<><span>{porProdutor.length} produtores</span><span className="font-medium text-mate-700">{formatar.kg(peso)}</span></>}
          />
        </Painel>

        <Painel titulo="Por matéria-prima">
          <div className="flex flex-col gap-3 px-4 py-4">
            {porTipo.map((g, i) => (
              <Barra key={g.chave} rotulo={g.chave}
                     valor={`${formatar.porcento((g.peso / peso) * 100)} · ${formatar.kg(g.peso)}`}
                     proporcao={(g.peso / peso) * 100}
                     cor={i === 0 ? 'bg-mate-700' : 'bg-mate-300'} />
            ))}
          </div>
        </Painel>
      </div>

      <Painel titulo="Recebimento por dia" acao={<SaidaDoPainel aoExportar={exportar} />}>
        <div className="flex flex-col gap-3 px-4 py-4">
          {porDia
            .slice()
            .sort((a, b) => (a.chave < b.chave ? -1 : 1))
            .map((g) => (
              <Barra key={g.chave}
                     rotulo={`${formatar.data(g.chave)} · ${g.cargas} ${g.cargas === 1 ? 'carga' : 'cargas'}`}
                     valor={formatar.kg(g.peso)}
                     proporcao={(g.peso / maiorDia) * 100}
                     cor="bg-mate-500" />
            ))}
        </div>
      </Painel>
    </>
  )
}

// ---------------------------------------------------------------------------
// ABA 2 · qualidade
// ---------------------------------------------------------------------------

function Qualidade({ lista }) {
  const analisadas = lista.filter((c) => c.analise)
  const pendentes = lista.filter((c) => !c.analise)

  if (!analisadas.length) {
    return (
      <Painel titulo="Qualidade">
        <Vazio texto={
          pendentes.length
            ? `Nenhuma análise lançada no período. ${pendentes.length} ${pendentes.length === 1 ? 'carga aguarda' : 'cargas aguardam'} o laboratório.`
            : 'Nenhuma carga no período selecionado.'
        } />
      </Painel>
    )
  }

  const palitoMedio = media(analisadas, (c) => c.analise.palitoPercentual)
  const umidadeMedia = media(analisadas.filter((c) => c.analise.umidadePercentual != null), (c) => c.analise.umidadePercentual)
  const acimaDoLimite = analisadas.filter((c) => Number(c.analise.palitoPercentual) > Number(c.analise.limitePalito))
  const reprovadas = analisadas.filter((c) => c.analise.aprovada === false)

  // ---------------------------------------------------------------------
  // O CARD DE DESCONTO FALA DE UM CONJUNTO SÓ
  // ---------------------------------------------------------------------
  // Desconto em dinheiro só existe para carga que já tem preço — e preço só
  // existe depois da emissão da ordem, porque é lá que ele é acordado. Antes
  // disso o desconto existe apenas em pontos percentuais.
  //
  // Antes, o número grande somava reais dessas cargas e o texto de apoio
  // mostrava a média percentual de TODAS as analisadas. Duas populações
  // diferentes no mesmo card: o leitor dividia um pelo outro e não fechava.
  // Agora as duas medidas saem da mesma lista.
  const comPreco = analisadas.filter(
    (c) => c.precoBaseKg != null && c.analise.precoAjustadoKg != null
  )
  const descontoEmReais = somar(
    comPreco,
    (c) => Number(c.pesoLiquidoKg) * (Number(c.precoBaseKg) - Number(c.analise.precoAjustadoKg))
  )
  const descontoMedio = media(comPreco, (c) => c.analise.descontoPercentual)
  const valorAnalisado = somar(analisadas, (c) => c.analise.valorTotal)

  function exportar() {
    baixarCsv(
      'matech-qualidade',
      ['Ticket', 'Data', 'Produtor', 'Matéria-prima', 'Peso líquido (kg)',
       'Palito (%)', 'Umidade (%)', 'Folha (%)', 'Limite (%)', 'Desconto (%)',
       'Preço base (R$/kg)', 'Preço ajustado (R$/kg)', 'Valor (R$)', 'Aprovada'],
      analisadas.map((c) => [
        c.numeroTicket,
        formatar.dataHora(c.analise.dataHora),
        c.produtor?.nome,
        formatar.materiaPrima(c.tipoMateriaPrima),
        numeroCsv(c.pesoLiquidoKg),
        numeroCsv(c.analise.palitoPercentual, 1),
        numeroCsv(c.analise.umidadePercentual, 1),
        numeroCsv(c.analise.folhaPercentual, 1),
        numeroCsv(c.analise.limitePalito, 1),
        numeroCsv(c.analise.descontoPercentual, 2),
        numeroCsv(c.precoBaseKg, 4),
        numeroCsv(c.analise.precoAjustadoKg, 4),
        numeroCsv(c.analise.valorTotal),
        c.analise.aprovada === false ? 'Não' : 'Sim',
      ])
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Indicador rotulo="Cargas analisadas" valor={analisadas.length} unidade={`de ${lista.length}`}
                   apoio={`${pendentes.length} aguardando`} cor="text-mate-700" />
        <Indicador rotulo="Palito médio" valor={formatar.porcento(palitoMedio)}
                   apoio={`limite acordado: ${LIMITE_PALITO_PADRAO}%`}
                   cor={palitoMedio > LIMITE_PALITO_PADRAO ? 'text-alerta' : 'text-tinta'} />
        <Indicador rotulo="Acima do limite" valor={acimaDoLimite.length} unidade="cargas"
                   apoio={`${formatar.porcento((acimaDoLimite.length / analisadas.length) * 100)} das analisadas`}
                   cor="text-alerta" />
        <Indicador rotulo="Desconto concedido" valor={formatar.reais(descontoEmReais)}
                   apoio={comPreco.length
                     ? `${comPreco.length} ${comPreco.length === 1 ? 'carga já precificada' : 'cargas já precificadas'} · média de ${formatar.porcento(descontoMedio, 2)}`
                     : 'nenhuma carga precificada ainda'}
                   cor="text-perigo" />
      </div>

      <div className="mb-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_360px]">
        <Painel titulo="Análises lançadas" acao={<SaidaDoPainel aoExportar={exportar} />}>
          <Tabela
            colunas={[
              { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
              { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 190, render: (c) => c.produtor?.nome },
              { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', render: (c) => formatar.kg(c.pesoLiquidoKg) },
              {
                chave: 'palito', titulo: 'Palito', alinhar: 'direita', forte: true,
                render: (c) => (
                  <span className={Number(c.analise.palitoPercentual) > Number(c.analise.limitePalito) ? 'text-alerta' : ''}>
                    {formatar.porcento(c.analise.palitoPercentual)}
                  </span>
                ),
              },
              { chave: 'umidade', titulo: 'Umidade', alinhar: 'direita', oculta: 'xl', render: (c) => formatar.porcento(c.analise.umidadePercentual) },
              {
                chave: 'desconto', titulo: 'Desconto', alinhar: 'direita',
                render: (c) => Number(c.analise.descontoPercentual) > 0
                  ? <span className="font-semibold text-perigo">−{formatar.porcento(c.analise.descontoPercentual, 2)}</span>
                  : <span className="text-cinza-400">—</span>,
              },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise.valorTotal) },
              {
                chave: 'aprovada', titulo: 'Resultado',
                render: (c) => c.analise.aprovada === false
                  ? <Etiqueta tom="perigo">reprovada</Etiqueta>
                  : <Etiqueta tom="verde">aprovada</Etiqueta>,
              },
            ]}
            dados={analisadas}
            rodape={
              <>
                <span>{analisadas.length} análises · {reprovadas.length} reprovadas</span>
                <span className="font-medium text-mate-700">{formatar.reais(valorAnalisado)} apurados</span>
              </>
            }
          />
        </Painel>

        <div className="flex flex-col gap-3">
          <Painel titulo="Distribuição do percentual de palito">
            <div className="flex flex-col gap-3 px-4 py-4">
              {faixasDePalito(analisadas).map((f) => (
                <Barra key={f.rotulo} rotulo={f.rotulo}
                       valor={`${f.cargas} ${f.cargas === 1 ? 'carga' : 'cargas'}`}
                       proporcao={(f.cargas / analisadas.length) * 100}
                       cor={f.acima ? 'bg-alerta' : 'bg-mate-500'} />
              ))}
            </div>
          </Painel>

          <Painel titulo="Umidade média e resultado">
            <div className="grid grid-cols-2 gap-3 px-4 py-4">
              {[
                ['Umidade média', umidadeMedia == null ? '—' : formatar.porcento(umidadeMedia)],
                ['Folha média', formatar.porcento(media(analisadas.filter((c) => c.analise.folhaPercentual != null), (c) => c.analise.folhaPercentual))],
                ['Aprovadas', `${analisadas.length - reprovadas.length} de ${analisadas.length}`],
                ['Reprovadas', String(reprovadas.length)],
              ].map(([r, v]) => (
                <div key={r}>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">{r}</p>
                  <p className="mt-0.5 text-base font-bold tabular text-tinta">{v}</p>
                </div>
              ))}
            </div>
          </Painel>
        </div>
      </div>

    </>
  )
}

// ---------------------------------------------------------------------------
// ABA 3 · financeiro
// ---------------------------------------------------------------------------

function Financeiro({ ordens }) {
  if (!ordens.length) {
    return <Painel titulo="Financeiro"><Vazio texto="Nenhuma ordem de pagamento emitida no período selecionado." /></Painel>
  }

  const total = ordens.reduce((s, o) => s + Number(o.valorTotal), 0)
  const pagas = ordens.filter((o) => o.situacao === 'PAGA')
  const pendentes = ordens.filter((o) => o.situacao === 'PENDENTE')
  const valorPago = pagas.reduce((s, o) => s + Number(o.valorTotal), 0)
  const valorAberto = pendentes.reduce((s, o) => s + Number(o.valorTotal), 0)

  const porProdutor = Object.values(
    ordens.reduce((acc, o) => {
      const nome = o.produtor?.nome || 'sem produtor'
      acc[nome] = acc[nome] || { chave: nome, ordens: 0, total: 0, pago: 0, aberto: 0 }
      acc[nome].ordens += 1
      acc[nome].total += Number(o.valorTotal)
      if (o.situacao === 'PAGA') acc[nome].pago += Number(o.valorTotal)
      if (o.situacao === 'PENDENTE') acc[nome].aberto += Number(o.valorTotal)
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)

  function exportar() {
    baixarCsv(
      'matech-financeiro',
      ['Ordem', 'Produtor', 'CPF/CNPJ', 'Período início', 'Período fim', 'Cargas',
       'Valor (R$)', 'Chave Pix na emissão', 'Situação', 'Emitida em', 'Paga em'],
      ordens.map((o) => [
        o.numero,
        o.produtor?.nome,
        o.produtor?.cpfCnpj || '',
        formatar.data(o.periodoInicio),
        formatar.data(o.periodoFim),
        o._count?.itens ?? '',
        numeroCsv(o.valorTotal),
        o.chavePixSnapshot || '',
        o.situacao,
        formatar.dataHora(o.emitidaEm),
        o.pagaEm ? formatar.dataHora(o.pagaEm) : '',
      ])
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Indicador rotulo="Emitido no período" valor={formatar.reais(total)}
                   apoio={`${ordens.length} ordens`} cor="text-mate-700" />
        <Indicador rotulo="Pago" valor={formatar.reais(valorPago)}
                   apoio={`${pagas.length} ordens quitadas`} cor="text-mate-700" />
        <Indicador rotulo="Em aberto" valor={formatar.reais(valorAberto)}
                   apoio={`${pendentes.length} ordens aguardando`} cor="text-alerta" />
        <Indicador rotulo="Ordem média" valor={formatar.reais(total / ordens.length)}
                   apoio="valor médio por ordem emitida" />
      </div>

      <div className="mb-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_360px]">
        <Painel titulo="Ordens emitidas" acao={<SaidaDoPainel aoExportar={exportar} />}>
          <Tabela
            colunas={[
              { chave: 'numero', titulo: 'Ordem', forte: true },
              { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 200, render: (o) => o.produtor?.nome },
              { chave: 'periodo', titulo: 'Período', oculta: 'xl', render: (o) => `${formatar.data(o.periodoInicio)} a ${formatar.data(o.periodoFim)}` },
              { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (o) => o._count?.itens ?? '—' },
              { chave: 'emitida', titulo: 'Emitida', render: (o) => formatar.data(o.emitidaEm) },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (o) => formatar.reais(o.valorTotal) },
              { chave: 'situacao', titulo: 'Situação', render: (o) => <Situacao valor={o.situacao} /> },
            ]}
            dados={ordens}
            rodape={<><span>{ordens.length} ordens</span><span className="font-medium text-mate-700">{formatar.reais(total)}</span></>}
          />
        </Painel>

        <Painel titulo="Por produtor">
          <Tabela
            colunas={[
              { chave: 'chave', titulo: 'Produtor', forte: true, truncar: 150 },
              { chave: 'ordens', titulo: 'Ordens', alinhar: 'direita' },
              { chave: 'pago', titulo: 'Pago', alinhar: 'direita', render: (g) => (g.pago ? formatar.reais(g.pago) : '—') },
              { chave: 'aberto', titulo: 'Em aberto', alinhar: 'direita', forte: true, render: (g) => (g.aberto ? formatar.reais(g.aberto) : '—') },
            ]}
            dados={porProdutor}
          />
        </Painel>
      </div>

    </>
  )
}

// ---------------------------------------------------------------------------
// ABA 4 · acurácia da estimativa de campo
// ---------------------------------------------------------------------------
// Este é o relatório que o trabalho escrito precisa. Ele compara duas medidas
// da MESMA carga: a que o avaliador estimou no erval, pelo celular, e a que a
// balança mediu na chegada. A diferença entre elas é a acurácia da avaliação
// em campo — um dos indicadores do Quadro 9.
//
// Só entram cargas que tenham pesoEstimadoCampoKg preenchido: sem estimativa
// não há o que comparar, e incluí-las como "desvio zero" inflaria o resultado.

function Acuracia({ lista }) {
  const comEstimativa = lista.filter(
    (c) => c.pesoEstimadoCampoKg != null && Number(c.pesoEstimadoCampoKg) > 0
  )

  if (!comEstimativa.length) {
    return (
      <Painel titulo="Acurácia da estimativa de campo">
        <div className="px-4 py-4">
          <Aviso>
            Nenhuma das {lista.length} cargas do período tem peso estimado em campo.
            Sem estimativa não há o que comparar com a balança.
          </Aviso>
        </div>
      </Painel>
    )
  }

  const comDesvio = comEstimativa.map((c) => {
    const estimado = Number(c.pesoEstimadoCampoKg)
    const real = Number(c.pesoLiquidoKg)
    const diferenca = real - estimado
    return { ...c, estimado, real, diferenca, desvio: (diferenca / estimado) * 100 }
  })

  const desvioMedioAbsoluto = media(comDesvio, (c) => Math.abs(c.desvio))
  const vies = media(comDesvio, (c) => c.desvio)
  const dentroDeDez = comDesvio.filter((c) => Math.abs(c.desvio) <= 10)
  const totalEstimado = somar(comDesvio, (c) => c.estimado)
  const totalReal = somar(comDesvio, (c) => c.real)

  function exportar() {
    baixarCsv(
      'matech-acuracia-estimativa',
      ['Ticket', 'Data', 'Produtor', 'Erval', 'Matéria-prima',
       'Estimado em campo (kg)', 'Pesado na balança (kg)', 'Diferença (kg)', 'Desvio (%)'],
      comDesvio.map((c) => [
        c.numeroTicket,
        formatar.data(c.dataHora),
        c.produtor?.nome,
        c.erval?.identificacao || '',
        formatar.materiaPrima(c.tipoMateriaPrima),
        numeroCsv(c.estimado),
        numeroCsv(c.real),
        numeroCsv(c.diferenca),
        numeroCsv(c.desvio, 2),
      ])
    )
  }

  const maiorDesvio = Math.max(1, ...comDesvio.map((c) => Math.abs(c.desvio)))

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Indicador rotulo="Cargas comparáveis" valor={comDesvio.length} unidade={`de ${lista.length}`}
                   apoio="com estimativa de campo" cor="text-mate-700" />
        <Indicador rotulo="Desvio médio absoluto" valor={formatar.porcento(desvioMedioAbsoluto)}
                   apoio="erro da estimativa, em módulo"
                   cor={desvioMedioAbsoluto <= 10 ? 'text-mate-700' : 'text-alerta'} />
        <Indicador rotulo="Viés" valor={`${vies > 0 ? '+' : ''}${formatar.porcento(vies)}`}
                   apoio={vies > 0 ? 'a balança pesa mais que o estimado' : 'a balança pesa menos que o estimado'} />
        <Indicador rotulo="Dentro de ±10%" valor={dentroDeDez.length} unidade="cargas"
                   apoio={`${formatar.porcento((dentroDeDez.length / comDesvio.length) * 100)} das comparáveis`} />
      </div>

      <Painel
        titulo="Estimado em campo × pesado na balança"
        acao={<SaidaDoPainel aoExportar={exportar} />}
      >
        <Tabela
          colunas={[
            { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
            { chave: 'data', titulo: 'Data', render: (c) => formatar.data(c.dataHora) },
            { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 220, render: (c) => c.produtor?.nome },
            { chave: 'erval', titulo: 'Erval', truncar: 150, oculta: 'lg', render: (c) => c.erval?.identificacao || '—' },
            { chave: 'estimado', titulo: 'Estimado', alinhar: 'direita', render: (c) => formatar.kg(c.estimado) },
            { chave: 'real', titulo: 'Pesado', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.real) },
            {
              chave: 'diferenca', titulo: 'Diferença', alinhar: 'direita',
              render: (c) => (
                <span className={c.diferenca < 0 ? 'text-perigo' : 'text-mate-700'}>
                  {c.diferenca > 0 ? '+' : ''}{formatar.numero(c.diferenca)} kg
                </span>
              ),
            },
            {
              chave: 'desvio', titulo: 'Desvio', alinhar: 'direita', forte: true,
              render: (c) => (
                <span className={Math.abs(c.desvio) > 10 ? 'text-alerta' : ''}>
                  {c.desvio > 0 ? '+' : ''}{formatar.porcento(c.desvio)}
                </span>
              ),
            },
            {
              chave: 'barra', titulo: 'Erro relativo', largura: '120px', oculta: 'xl',
              render: (c) => (
                <div className="h-[7px] w-full bg-cabecalho">
                  <div className={`h-full ${Math.abs(c.desvio) > 10 ? 'bg-alerta' : 'bg-mate-500'}`}
                       style={{ width: `${(Math.abs(c.desvio) / maiorDesvio) * 100}%` }} />
                </div>
              ),
            },
          ]}
          dados={comDesvio}
          rodape={
            <>
              <span>
                Total estimado {formatar.kg(totalEstimado)} · total pesado {formatar.kg(totalReal)}
              </span>
              <span className="font-medium text-mate-700">
                diferença acumulada {formatar.kg(totalReal - totalEstimado)}
              </span>
            </>
          }
        />
      </Painel>

    </>
  )
}

// ---------------------------------------------------------------------------
// Contas auxiliares
// ---------------------------------------------------------------------------

function somar(itens, obter) {
  return itens.reduce((s, i) => s + (Number(obter(i)) || 0), 0)
}

function media(itens, obter) {
  if (!itens.length) return null
  return somar(itens, obter) / itens.length
}

/** Agrupa por uma chave e devolve a lista já ordenada por peso, do maior. */
function agrupar(cargas, obterChave) {
  const mapa = cargas.reduce((acc, c) => {
    const chave = obterChave(c)
    acc[chave] = acc[chave] || { chave, cargas: 0, peso: 0, valor: 0 }
    acc[chave].cargas += 1
    acc[chave].peso += Number(c.pesoLiquidoKg)
    acc[chave].valor += Number(c.analise?.valorTotal || 0)
    return acc
  }, {})
  return Object.values(mapa).sort((a, b) => b.peso - a.peso)
}

/**
 * A rota de pagamentos filtra por produtor e por situação, mas não por data.
 * O recorte por período é feito aqui, sobre a data de EMISSÃO da ordem — que é
 * o que o financeiro pergunta ("o que foi emitido neste mês"), e não sobre o
 * período que a ordem cobre, que pode atravessar o filtro.
 */
function recortarPorPeriodo(ordens, { de, ate }) {
  if (!de && !ate) return ordens
  const inicio = de ? new Date(`${de}T00:00:00`) : null
  const fim = ate ? new Date(`${ate}T23:59:59`) : null
  return ordens.filter((o) => {
    const emitida = new Date(o.emitidaEm)
    if (inicio && emitida < inicio) return false
    if (fim && emitida > fim) return false
    return true
  })
}

/** Faixas fixas para a distribuição do palito, com o limite acordado no meio. */
function faixasDePalito(analisadas) {
  const faixas = [
    { rotulo: 'até 20%', teste: (v) => v <= 20, acima: false },
    { rotulo: `20% a ${LIMITE_PALITO_PADRAO}%`, teste: (v) => v > 20 && v <= LIMITE_PALITO_PADRAO, acima: false },
    { rotulo: `${LIMITE_PALITO_PADRAO}% a 40%`, teste: (v) => v > LIMITE_PALITO_PADRAO && v <= 40, acima: true },
    { rotulo: 'acima de 40%', teste: (v) => v > 40, acima: true },
  ]
  return faixas.map((f) => ({
    ...f,
    cargas: analisadas.filter((c) => f.teste(Number(c.analise.palitoPercentual))).length,
  }))
}
