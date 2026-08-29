// ---------------------------------------------------------------------------
// PÁGINA · matéria-prima e preços praticados
// ---------------------------------------------------------------------------
// Não existe cadastro de matéria-prima nem tabela de preços no MATECH, e isso
// foi opção de projeto: o tipo é um enum de quatro valores, e o preço é
// acordado carga a carga (combinado no erval, gravado na pesagem, ajustado
// pela análise). Esta tela mostra o que foi efetivamente praticado, extraído
// das cargas do período.

import { useEffect, useState, useCallback } from 'react'
import { cargas as apiCargas } from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, SaidaDoPainel, Tabela, Indicador, Situacao, Campo, Selecao, Botao,
  Carregando, Erro
} from '../componentes/ui'
import { baixarCsv, numeroCsv } from '../lib/exportar'
import { useAutenticacao } from '../contexto/Autenticacao'
import { formatar, contagem } from '../lib/formatar'

// A mesma ordem do enum no banco, para a tela não sugerir uma hierarquia
// que o modelo não tem.
const TIPOS = ['ERVA_MATE_PLANTADA', 'ERVA_MATE_NATIVA', 'PALITO', 'LENHA']

export default function MateriaPrima() {
  // Esta tela é metade volume e metade preço. Sem o perfil que vê dinheiro, o
  // servidor não manda preço nem valor — e a metade de preço some inteira, em
  // vez de virar uma tabela de travessões. O que sobra continua sendo útil:
  // quanto de cada matéria-prima entrou, e a participação de cada uma.
  const { podeFazer } = useAutenticacao()
  const veDinheiro = podeFazer('ADMINISTRATIVO')

  const [filtros, setFiltros] = useState({ de: '', ate: '' })
  const [tipo, setTipo] = useState('')
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // porPagina alto de propósito: um resumo por tipo calculado sobre 20
      // cargas quando existem 300 no período não é resumo, é amostra.
      const r = await apiCargas.listar({ ...filtros, porPagina: 500 })
      setLista(r.cargas)
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => { buscar() }, [buscar])

  const resumo = TIPOS.map((t) => resumirTipo(t, lista))
  const pesoGeral = resumo.reduce((s, r) => s + r.peso, 0)
  const valorGeral = resumo.reduce((s, r) => s + r.valor, 0)

  // O filtro por tipo é do navegador: a lista do período já está em memória e
  // ir ao servidor de novo só para esconder linhas seria ida perdida.
  const cargasDoTipo = tipo ? lista.filter((c) => c.tipoMateriaPrima === tipo) : lista

  function exportar() {
    baixarCsv(
      'matech-precos-praticados',
      ['Matéria-prima', 'Cargas', 'Peso líquido (kg)', 'Participação (%)',
       'Preço base médio (R$/kg)', 'Preço ajustado médio (R$/kg)',
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
      <CabecalhoPagina titulo="Matéria-prima e preços">
        <SaidaDoPainel aoExportar={carregando || lista.length === 0 ? null : exportar} />
      </CabecalhoPagina>

      <Filtros>
        <Campo rotulo="De" type="date" className="flex-1" value={filtros.de}
               onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
        <Campo rotulo="Até" type="date" className="flex-1" value={filtros.ate}
               onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        <Selecao rotulo="Matéria-prima" className="flex-[2]" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{formatar.materiaPrima(t)}</option>)}
        </Selecao>
        <Botao onClick={() => { setFiltros({ de: '', ate: '' }); setTipo('') }}>Limpar</Botao>
      </Filtros>

      <Erro erro={erro} />

      {carregando ? (
        <Painel titulo="Resumo por tipo"><Carregando /></Painel>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 xl:gap-2.5">
            {veDinheiro && (
              <>
                <Indicador rotulo="Valor já analisado" valor={formatar.reais(valorGeral)}
                           apoio="cargas com análise lançada" cor="text-mate-700" />
                <Indicador rotulo="Preço médio praticado"
                           valor={formatar.precoKg(mediaPonderada(lista, (c) => c.precoBaseKg))}
                           apoio="ponderado pelo peso" />
              </>
            )}
            <Indicador rotulo="Peso recebido" valor={formatar.numero(pesoGeral)} unidade="kg"
                       apoio={contagem(lista.length, 'carga no período', 'cargas no período')} />
          </div>

          <Painel className="mb-3" titulo={veDinheiro ? 'Preços praticados por tipo' : 'Recebido por tipo'}>
            <Tabela
              colunas={[
                { chave: 'tipo', titulo: 'Matéria-prima', forte: true, render: (r) => formatar.materiaPrima(r.tipo) },
                { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (r) => r.cargas || '—' },
                { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (r) => (r.cargas ? formatar.kg(r.peso) : '—') },
                { chave: 'part', titulo: 'Part.', alinhar: 'direita', render: (r) => (pesoGeral && r.peso ? formatar.porcento((r.peso / pesoGeral) * 100, 0) : '—') },
                ...(veDinheiro ? [
                  { chave: 'base', titulo: 'Preço base', alinhar: 'direita', render: (r) => formatar.precoKg(r.precoBaseMedio) },
                  { chave: 'faixa', titulo: 'Faixa praticada', alinhar: 'direita', oculta: 'lg', render: (r) => (r.precoMinimo == null ? '—' : `${formatar.reais(r.precoMinimo)} a ${formatar.reais(r.precoMaximo)}`) },
                  { chave: 'ajustado', titulo: 'Após análise', alinhar: 'direita', render: (r) => formatar.precoKg(r.precoAjustadoMedio) },
                  { chave: 'valor', titulo: 'Valor analisado', alinhar: 'direita', forte: true, render: (r) => (r.valor ? formatar.reais(r.valor) : '—') },
                ] : []),
              ]}
              dados={resumo}
              vazio="Nenhuma carga no período."
            />
          </Painel>

          <Painel
            titulo={tipo ? `Cargas · ${formatar.materiaPrima(tipo)}` : 'Cargas do período'}
            acao={`${cargasDoTipo.length} de ${lista.length}`}
          >
            <Tabela
              colunas={[
                { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
                { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.dataHora(c.dataHora) },
                { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 190, render: (c) => c.produtor?.nome },
                { chave: 'tipo', titulo: 'Matéria-prima', oculta: 'lg', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
                { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
                ...(veDinheiro ? [
                  { chave: 'base', titulo: 'Preço base', alinhar: 'direita', render: (c) => formatar.precoKg(c.precoBaseKg) },
                  {
                    chave: 'ajustado', titulo: 'Após análise', alinhar: 'direita',
                    render: (c) => c.analise
                      ? <span className={Number(c.analise.descontoPercentual) > 0 ? 'text-perigo' : ''}>
                          {formatar.precoKg(c.analise.precoAjustadoKg)}
                        </span>
                      : <span className="text-cinza-400">—</span>,
                  },
                  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise?.valorTotal) },
                ] : []),
                { chave: 'situacao', titulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
              ]}
              dados={cargasDoTipo}
              vazio={tipo
                ? `Nenhuma carga de ${formatar.materiaPrima(tipo).toLowerCase()} no período.`
                : 'Nenhuma carga registrada no período.'}
            />
          </Painel>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Contas do resumo
// ---------------------------------------------------------------------------

/**
 * Média PONDERADA pelo peso, não média simples.
 * Uma carga de 8 toneladas a R$ 4,85 e outra de 300 kg a R$ 0,32 não têm o
 * mesmo peso na formação do preço médio — a média simples daria R$ 2,58, um
 * número que não corresponde a nada que tenha acontecido.
 */
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
  // Number(null) é 0, e não NaN — por isso o filtro é pelo próprio campo, e
  // não pelo resultado da conversão. Sem isso, uma carga sem preço entraria na
  // faixa como "menor preço: R$ 0,00".
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
