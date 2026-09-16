import { useEffect, useState, useCallback } from 'react'
import {
  cargas as apiCargas,
  pagamentos as apiPagamentos,
  produtores as apiProdutores,
} from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  FaixaDeIndicadores, Painel, Filtros, SaidaDoPainel, Tabela, Indicador, Situacao, Campo, Selecao, Abas, Barra,
  Carregando, Erro, Vazio, Etiqueta, Aviso
} from '../componentes/ui'
import { useAutenticacao } from '../contexto/Autenticacao'
import { baixarCsv, numeroCsv } from '../lib/exportar'
import { formatar, contagem } from '../lib/formatar'
import { motivoResumido } from '../lib/reprovacao'
import { ICONE_DA_GRANDEZA } from '../lib/icones'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

const ABAS = [
  { id: 'recebimento', rotulo: 'Recebimento' },
  { id: 'qualidade', rotulo: 'Qualidade' },
  { id: 'materia-prima', rotulo: 'Matéria-prima' },
  { id: 'financeiro', rotulo: 'Financeiro', exigeDinheiro: true },
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

      <Filtros
        ativos={resumirFiltros(filtros, {
          de: (v) => `De ${formatar.data(v)}`,
          ate: (v) => `Até ${formatar.data(v)}`,
          produtorId: (v) => nomeNaLista(listaProdutores, v),
        })}
        aoRemover={(chave) => setFiltros((f) => ({ ...f, [chave]: '' }))}
        aoLimpar={() => setFiltros({ de: '', ate: '', produtorId: '' })}
      >
        <Campo rotulo="De" type="date" className="flex-1" value={filtros.de}
               onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
        <Campo rotulo="Até" type="date" className="flex-1" value={filtros.ate}
               onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        <Selecao rotulo="Produtor" className="flex-[2]" value={filtros.produtorId}
                 onChange={(e) => setFiltros((f) => ({ ...f, produtorId: e.target.value }))}>
          <option value="">Todos os produtores</option>
          {listaProdutores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
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
          {aba === 'recebimento' && <Recebimento lista={lista} veDinheiro={veDinheiro} />}
          {aba === 'qualidade' && <Qualidade lista={lista} veDinheiro={veDinheiro} />}
          {aba === 'materia-prima' && <MateriaPrima lista={lista} veDinheiro={veDinheiro} />}
          {aba === 'financeiro' && veDinheiro && <Financeiro ordens={ordens} />}
        </>
      )}
    </>
  )
}

function Recebimento({ lista, veDinheiro }) {
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
       'Peso bruto (kg)', 'Tara (kg)', 'Peso líquido (kg)',
       ...(veDinheiro ? ['Preço base (R$/kg)', 'Preço ajustado (R$/kg)', 'Valor (R$)'] : []),
       'Situação'],
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
        ...(veDinheiro
          ? [numeroCsv(c.precoBaseKg, 4), numeroCsv(c.analise?.precoAjustadoKg, 4), numeroCsv(c.analise?.valorTotal)]
          : []),
        c.situacao,
      ])
    )
  }

  return (
    <>
      <FaixaDeIndicadores>
        <Indicador rotulo="Peso líquido recebido" icone={ICONE_DA_GRANDEZA.peso} valor={formatar.numero(peso)} unidade="kg"
                   apoio={`${lista.length} cargas`} />
        <Indicador rotulo="Média por carga" icone={ICONE_DA_GRANDEZA.cargas} valor={formatar.numero(peso / lista.length)} unidade="kg"
                   apoio="peso líquido médio" />
        <Indicador rotulo="Tara descontada" icone={ICONE_DA_GRANDEZA.peso} valor={formatar.numero(tara)} unidade="kg"
                   apoio={`${formatar.porcento((tara / bruto) * 100)} do peso bruto`} />
        <Indicador rotulo="Produtores atendidos" icone={ICONE_DA_GRANDEZA.produtores} valor={porProdutor.length} unidade="produtores"
                   apoio="com entrega no período" />
      </FaixaDeIndicadores>

      <div className="mb-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_360px]">
        <Painel titulo="Recebimento por produtor" acao={`${porProdutor.length} produtores`}>
          <Tabela
            colunas={[
              { chave: 'chave', titulo: 'Produtor', forte: true, truncar: 240 },
              { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita' },
              { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (g) => formatar.kg(g.peso) },
              { chave: 'part', titulo: 'Part.', alinhar: 'direita', render: (g) => formatar.porcento((g.peso / peso) * 100) },
              ...(veDinheiro
                ? [{ chave: 'valor', titulo: 'Valor analisado', alinhar: 'direita', forte: true, render: (g) => (g.valor ? formatar.reais(g.valor) : '—') }]
                : []),
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

      <Painel className="mb-6" titulo="Recebimento por dia" acao={<SaidaDoPainel aoExportar={exportar} />}>
        <div className="flex flex-col gap-3 px-4 py-4">
          {porDia
            .slice()
            .sort((a, b) => (a.chave < b.chave ? -1 : 1))
            .map((g) => (
              <Barra key={g.chave}
                     rotulo={`${formatar.data(g.chave)} · ${contagem(g.cargas, 'carga', 'cargas')}`}
                     valor={formatar.kg(g.peso)}
                     proporcao={(g.peso / maiorDia) * 100}
                     cor="bg-mate-500" />
            ))}
        </div>
      </Painel>
    </>
  )
}

function Qualidade({ lista, veDinheiro }) {
  const analisadas = lista.filter((c) => c.analise)
  const pendentes = lista.filter((c) => !c.analise)

  if (!analisadas.length) {
    return (
      <Painel titulo="Qualidade">
        <Vazio texto={
          pendentes.length
            ? `Nenhuma análise lançada no período. ${contagem(pendentes.length, 'carga aguarda', 'cargas aguardam')} o laboratório.`
            : 'Nenhuma carga no período selecionado.'
        } />
      </Painel>
    )
  }

  const palitoMedio = media(analisadas, (c) => c.analise.palitoPercentual)
  const umidadeMedia = media(analisadas.filter((c) => c.analise.umidadePercentual != null), (c) => c.analise.umidadePercentual)
  const folhaMedia = media(analisadas.filter((c) => c.analise.folhaPercentual != null), (c) => c.analise.folhaPercentual)
  const reprovadas = analisadas.filter((c) => c.analise.aprovada === false)
  const valorAnalisado = somar(analisadas, (c) => c.analise.valorTotal)

  function exportar() {
    baixarCsv(
      'matech-qualidade',
      ['Ticket', 'Data', 'Produtor', 'Matéria-prima', 'Peso líquido (kg)',
       'Palito (%)', 'Umidade (%)', 'Folha (%)',
       ...(veDinheiro ? ['Preço base (R$/kg)', 'Preço ajustado (R$/kg)', 'Valor (R$)'] : []),
       'Aprovada', 'Motivo'],
      analisadas.map((c) => [
        c.numeroTicket,
        formatar.dataHora(c.analise.dataHora),
        c.produtor?.nome,
        formatar.materiaPrima(c.tipoMateriaPrima),
        numeroCsv(c.pesoLiquidoKg),
        numeroCsv(c.analise.palitoPercentual, 1),
        numeroCsv(c.analise.umidadePercentual, 1),
        numeroCsv(c.analise.folhaPercentual, 1),
        ...(veDinheiro
          ? [numeroCsv(c.precoBaseKg, 4), numeroCsv(c.analise.precoAjustadoKg, 4), numeroCsv(c.analise.valorTotal)]
          : []),
        c.analise.aprovada === false ? 'Não' : 'Sim',
        c.analise.aprovada === false ? motivoResumido(c.analise) : '',
      ])
    )
  }

  return (
    <>
      <FaixaDeIndicadores>
        <Indicador rotulo="Cargas analisadas" icone={ICONE_DA_GRANDEZA.qualidade} valor={analisadas.length} unidade={`de ${lista.length}`}
                   apoio={`${pendentes.length} aguardando`} />
        <Indicador rotulo="Palito médio" icone={ICONE_DA_GRANDEZA.qualidade} valor={formatar.porcento(palitoMedio)}
                   apoio="medido nas amostras do período" />
        <Indicador rotulo="Reprovadas" icone={ICONE_DA_GRANDEZA.alerta} valor={reprovadas.length} unidade="cargas"
                   apoio={`${formatar.porcento((reprovadas.length / analisadas.length) * 100)} das analisadas`}
                   cor={reprovadas.length ? 'text-perigo' : 'text-tinta'} />
        {veDinheiro && <Indicador rotulo="Valor analisado" icone={ICONE_DA_GRANDEZA.dinheiro} valor={formatar.reais(valorAnalisado)}
                   apoio="cargas com preço já acordado" />}
      </FaixaDeIndicadores>

      <div className="mb-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_360px]">
        <Painel titulo="Análises lançadas" acao={<SaidaDoPainel aoExportar={exportar} />}>
          <Tabela
            colunas={[
              { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
              { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 190, render: (c) => c.produtor?.nome },
              { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', render: (c) => formatar.kg(c.pesoLiquidoKg) },
              {
                chave: 'palito', titulo: 'Palito', alinhar: 'direita', forte: true,
                render: (c) => formatar.porcento(c.analise.palitoPercentual),
              },
              { chave: 'umidade', titulo: 'Umidade', alinhar: 'direita', oculta: 'xl', render: (c) => formatar.porcento(c.analise.umidadePercentual) },
              { chave: 'folha', titulo: 'Folha', alinhar: 'direita', oculta: 'xl', render: (c) => formatar.porcento(c.analise.folhaPercentual) },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise.valorTotal) },
              {
                chave: 'motivo', titulo: 'Motivo', truncar: 240, oculta: 'xl',
                render: (c) => (c.analise.aprovada === false
                  ? <span className="text-perigo">{motivoResumido(c.analise)}</span>
                  : '—'),
              },
              {
                chave: 'aprovada', titulo: 'Resultado', fixar: 'direita',
                render: (c) => c.analise.aprovada === false
                  ? <Etiqueta tom="perigo">reprovada</Etiqueta>
                  : <Etiqueta tom="verde">aprovada</Etiqueta>,
              },
            ]}
            dados={analisadas}
            rodape={
              <>
                <span>{analisadas.length} análises · {reprovadas.length} reprovadas</span>
                {veDinheiro && (
                  <span className="font-medium text-mate-700">{formatar.reais(valorAnalisado)} apurados</span>
                )}
              </>
            }
          />
        </Painel>

        <div className="flex flex-col gap-3">
          <Painel titulo="Distribuição do percentual de palito">
            <div className="flex flex-col gap-3 px-4 py-4">
              {faixasDePalito(analisadas).map((f) => (
                <Barra key={f.rotulo} rotulo={f.rotulo}
                       valor={contagem(f.cargas, 'carga', 'cargas')}
                       proporcao={(f.cargas / analisadas.length) * 100}
                       cor="bg-mate-500" />
              ))}
            </div>
          </Painel>

          <Painel titulo="Umidade média e resultado">
            <div className="grid grid-cols-2 gap-3 px-4 py-4">
              {[
                ['Umidade média', umidadeMedia == null ? '—' : formatar.porcento(umidadeMedia)],
                ['Folha média', formatar.porcento(folhaMedia)],
                ['Aprovadas', `${analisadas.length - reprovadas.length} de ${analisadas.length}`],
                ['Reprovadas', String(reprovadas.length)],
              ].map(([r, v]) => (
                <div key={r}>
                  <p className="text-[11px] font-semibold text-cinza-600">{r}</p>
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

const TIPOS = ['ERVA_MATE_PLANTADA', 'ERVA_MATE_NATIVA', 'PALITO', 'LENHA']

function MateriaPrima({ lista, veDinheiro }) {
  const porTipo = TIPOS.map((t) => resumirTipo(t, lista))

  const resumo = porTipo.filter((r) => r.cargas > 0)
  const semMovimento = porTipo.filter((r) => r.cargas === 0)
  const pesoGeral = resumo.reduce((s, r) => s + r.peso, 0)
  const valorGeral = resumo.reduce((s, r) => s + r.valor, 0)

  if (!lista.length) {
    return <Painel titulo="Matéria-prima"><Vazio texto="Nenhuma carga registrada no período selecionado." /></Painel>
  }

  function exportar() {
    baixarCsv(
      'matech-precos-praticados',
      ['Matéria-prima', 'Cargas', 'Peso líquido (kg)', 'Participação (%)',
       'Preço base médio (R$/kg)', 'Preço praticado médio (R$/kg)',
       'Menor preço (R$/kg)', 'Maior preço (R$/kg)', 'Valor analisado (R$)'],
      resumo.map((r) => [
        formatar.materiaPrima(r.tipo),
        r.cargas,
        numeroCsv(r.peso),
        numeroCsv(pesoGeral ? (r.peso / pesoGeral) * 100 : 0, 1),
        numeroCsv(r.precoBaseMedio, 4),
        numeroCsv(r.precoAjustadoMedio, 4),
        numeroCsv(r.precoMinimo, 4),
        numeroCsv(r.precoMaximo, 4),
        numeroCsv(r.valor),
      ])
    )
  }

  return (
    <>
      <FaixaDeIndicadores>
        {veDinheiro && (
          <>
            <Indicador rotulo="Valor já analisado" icone={ICONE_DA_GRANDEZA.dinheiro} valor={formatar.reais(valorGeral)}
                       apoio="cargas com análise lançada" />
            <Indicador rotulo="Preço médio praticado" icone={ICONE_DA_GRANDEZA.preco}
                       valor={formatar.precoKgCurto(mediaPonderada(lista, (c) => c.precoBaseKg))}
                       apoio="ponderado pelo peso" />
          </>
        )}
        <Indicador rotulo="Peso recebido" icone={ICONE_DA_GRANDEZA.peso} valor={formatar.numero(pesoGeral)} unidade="kg"
                   apoio={contagem(lista.length, 'carga no período', 'cargas no período')} />
      </FaixaDeIndicadores>

      <Painel
        className="mb-6"
        titulo={veDinheiro ? 'Preços praticados por tipo' : 'Recebido por tipo'}
        acao={<SaidaDoPainel aoExportar={resumo.length ? exportar : null} />}
      >
        <Tabela
          colunas={[
            { chave: 'tipo', titulo: 'Matéria-prima', forte: true, render: (r) => formatar.materiaPrima(r.tipo) },
            { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (r) => r.cargas || '—' },
            { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (r) => formatar.kg(r.peso) },
            { chave: 'part', titulo: 'Part.', alinhar: 'direita', render: (r) => (pesoGeral && r.peso ? formatar.porcento((r.peso / pesoGeral) * 100, 0) : '—') },
            ...(veDinheiro ? [
              { chave: 'base', titulo: 'Preço base', alinhar: 'direita', render: (r) => formatar.precoKgCurto(r.precoBaseMedio) },
              { chave: 'faixa', titulo: 'Faixa praticada', alinhar: 'direita', oculta: 'lg', render: (r) => (r.precoMinimo == null ? '—' : `${formatar.reais(r.precoMinimo)} a ${formatar.reais(r.precoMaximo)}`) },
              { chave: 'praticado', titulo: 'Praticado', alinhar: 'direita', render: (r) => formatar.precoKgCurto(r.precoAjustadoMedio) },
              { chave: 'valor', titulo: 'Valor analisado', alinhar: 'direita', forte: true, render: (r) => (r.valor ? formatar.reais(r.valor) : '—') },
            ] : []),
          ]}
          dados={resumo}
          vazio="Nenhuma carga no período."
          rodape={semMovimento.length > 0 && (
            <span>
              Não entrou no período: {semMovimento.map((r) => formatar.materiaPrima(r.tipo).toLowerCase()).join(', ')}.
            </span>
          )}
        />
      </Painel>
    </>
  )
}

function mediaPonderada(cargas, obterPreco) {
  const validas = cargas.filter((c) => obterPreco(c) != null)
  const peso = validas.reduce((s, c) => s + Number(c.pesoLiquidoKg), 0)
  if (!peso) return null
  const soma = validas.reduce((s, c) => s + Number(c.pesoLiquidoKg) * Number(obterPreco(c)), 0)
  return soma / peso
}

function resumirTipo(tipo, cargas) {
  const doTipo = cargas.filter((c) => c.tipoMateriaPrima === tipo)
  const analisadas = doTipo.filter((c) => c.analise)
  const precos = doTipo
    .filter((c) => c.precoBaseKg != null)
    .map((c) => Number(c.precoBaseKg))

  return {
    tipo,
    cargas: doTipo.length,
    peso: doTipo.reduce((s, c) => s + Number(c.pesoLiquidoKg), 0),
    valor: analisadas.reduce((s, c) => s + Number(c.analise.valorTotal), 0),
    precoBaseMedio: mediaPonderada(doTipo, (c) => c.precoBaseKg),
    precoAjustadoMedio: mediaPonderada(analisadas, (c) => c.analise.precoAjustadoKg),
    precoMinimo: precos.length ? Math.min(...precos) : null,
    precoMaximo: precos.length ? Math.max(...precos) : null,
  }
}

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
      <FaixaDeIndicadores>
        <Indicador rotulo="Emitido no período" icone={ICONE_DA_GRANDEZA.dinheiro} valor={formatar.reais(total)}
                   apoio={`${ordens.length} ordens`} />
        <Indicador rotulo="Pago" icone={ICONE_DA_GRANDEZA.quitado} valor={formatar.reais(valorPago)}
                   apoio={`${pagas.length} ordens quitadas`} />
        <Indicador rotulo="Em aberto" icone={ICONE_DA_GRANDEZA.espera} valor={formatar.reais(valorAberto)}
                   apoio={`${pendentes.length} ordens aguardando`} cor="text-alerta" />
        <Indicador rotulo="Ordem média" icone={ICONE_DA_GRANDEZA.preco} valor={formatar.reais(total / ordens.length)}
                   apoio="valor médio por ordem emitida" />
      </FaixaDeIndicadores>

      <div className="mb-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_360px]">
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

function somar(itens, obter) {
  return itens.reduce((s, i) => s + (Number(obter(i)) || 0), 0)
}

function media(itens, obter) {
  if (!itens.length) return null
  return somar(itens, obter) / itens.length
}

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

function faixasDePalito(analisadas) {
  const faixas = [
    { rotulo: 'até 20%', teste: (v) => v <= 20 },
    { rotulo: '20% a 30%', teste: (v) => v > 20 && v <= 30 },
    { rotulo: '30% a 40%', teste: (v) => v > 30 && v <= 40 },
    { rotulo: 'acima de 40%', teste: (v) => v > 40 },
  ]
  return faixas.map((f) => ({
    ...f,
    cargas: analisadas.filter((c) => f.teste(Number(c.analise.palitoPercentual))).length,
  }))
}
