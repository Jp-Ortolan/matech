// ---------------------------------------------------------------------------
// PÁGINA · matéria-prima e preços praticados
// ---------------------------------------------------------------------------
// UMA DECISÃO DE MODELAGEM QUE ESTA TELA TORNA VISÍVEL:
//
// Não existe cadastro de matéria-prima no MATECH, e não existe tabela de
// preços. Foi opção de projeto, não esquecimento.
//
//   · o TIPO é um enum de quatro valores (TipoMateriaPrima no schema.prisma).
//     São quatro e não mudam com frequência; virar tabela só acrescentaria
//     uma tela de cadastro para gerenciar quatro linhas;
//
//   · o PREÇO é acordado carga a carga. O avaliador combina um valor no erval
//     (valorCombinadoKg na avaliação), a balança grava o preço da entrega
//     (precoBaseKg na carga) e o laboratório o ajusta pelo percentual de
//     palito (precoAjustadoKg na análise). Um preço fixo por tipo brigaria
//     com a forma como a ervateira negocia de verdade.
//
// Então esta tela não inventa um cadastro: ela mostra o que foi efetivamente
// praticado, extraído das cargas registradas no período.

import { useEffect, useState, useCallback } from 'react'
import { cargas as apiCargas } from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, SaidaDoPainel, Tabela, Indicador, Situacao, Campo, Botao, Barra, Aviso,
  Carregando, Erro, Vazio, Etiqueta, formatar,
} from '../componentes/ui'
import { baixarCsv, numeroCsv } from '../lib/exportar'

// A mesma ordem do enum no banco, para a tela não sugerir uma hierarquia
// que o modelo não tem.
const TIPOS = ['ERVA_MATE_PLANTADA', 'ERVA_MATE_NATIVA', 'PALITO', 'LENHA']

export default function MateriaPrima() {
  const [filtros, setFiltros] = useState({ de: '', ate: '' })
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tipoAberto, setTipoAberto] = useState(null)

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

  const resumo = TIPOS.map((tipo) => resumirTipo(tipo, lista))
  const pesoGeral = resumo.reduce((s, r) => s + r.peso, 0)
  const valorGeral = resumo.reduce((s, r) => s + r.valor, 0)

  const cargasDoTipo = tipoAberto ? lista.filter((c) => c.tipoMateriaPrima === tipoAberto) : lista

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
      <CabecalhoPagina
        titulo="Matéria-prima e preços"
        subtitulo={`Volume e preço praticado por tipo de matéria-prima · ${lista.length} cargas no período`}
      >
        <SaidaDoPainel aoExportar={carregando || lista.length === 0 ? null : exportar} />
      </CabecalhoPagina>

      <div className="mb-3 flex items-end gap-2.5 rounded-[3px] border border-borda bg-white px-4 py-3">
        <Campo rotulo="De" type="date" className="flex-1" value={filtros.de} onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
        <Campo rotulo="Até" type="date" className="flex-1" value={filtros.ate} onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        <div className="flex-[2]" />
        <Botao onClick={() => setFiltros({ de: '', ate: '' })}>Limpar período</Botao>
      </div>

      <Erro erro={erro} />

      {carregando ? (
        <Painel titulo="Resumo por tipo"><Carregando /></Painel>
      ) : (
        <>
          {/* O volume total saiu: está no Dashboard. "Tipos com movimento"
              também: a tabela logo abaixo já mostra quais se movimentaram, e
              contá-los num cartão é dizer duas vezes a mesma coisa. */}
          <div className="mb-3 flex flex-wrap gap-2 xl:mb-4 xl:gap-3">
            <Indicador rotulo="Valor já analisado" valor={formatar.reais(valorGeral)}
                       apoio="cargas com análise lançada" cor="text-mate-700" />
            <Indicador rotulo="Preço médio praticado"
                       valor={formatar.precoKg(mediaPonderada(lista, (c) => c.precoBaseKg))}
                       apoio="ponderado pelo peso, antes da análise" />
          </div>

          {/* ------------------------- cartões por tipo ------------------------- */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {resumo.map((r) => (
              <CartaoTipo
                key={r.tipo}
                resumo={r}
                participacao={pesoGeral ? (r.peso / pesoGeral) * 100 : 0}
                aberto={tipoAberto === r.tipo}
                aoAbrir={() => setTipoAberto((t) => (t === r.tipo ? null : r.tipo))}
              />
            ))}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_420px]">
            {/* ---------------------- tabela de preços ---------------------- */}
            <Painel titulo="Preços praticados no período" acao="extraído das cargas, não de um cadastro">
              <Tabela
                colunas={[
                  { chave: 'tipo', titulo: 'Matéria-prima', forte: true, render: (r) => formatar.materiaPrima(r.tipo) },
                  { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', render: (r) => r.cargas || '—' },
                  { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (r) => (r.cargas ? formatar.kg(r.peso) : '—') },
                  { chave: 'base', titulo: 'Preço base médio', alinhar: 'direita', render: (r) => formatar.precoKg(r.precoBaseMedio) },
                  { chave: 'faixa', titulo: 'Faixa praticada', alinhar: 'direita', render: (r) => (r.precoMinimo == null ? '—' : `${formatar.reais(r.precoMinimo)} a ${formatar.reais(r.precoMaximo)}`) },
                  { chave: 'ajustado', titulo: 'Após análise', alinhar: 'direita', render: (r) => formatar.precoKg(r.precoAjustadoMedio) },
                  { chave: 'valor', titulo: 'Valor analisado', alinhar: 'direita', forte: true, render: (r) => (r.valor ? formatar.reais(r.valor) : '—') },
                ]}
                dados={resumo}
                vazio="Nenhuma carga no período."
                rodape={
                  <>
                    <span>
                      O preço base é o combinado na entrega. O preço após análise já
                      inclui o desconto por percentual de palito.
                    </span>
                    <span className="font-medium text-mate-700">{formatar.kg(pesoGeral)} no total</span>
                  </>
                }
              />
            </Painel>

            {/* ------------------- participação por volume ------------------- */}
            <Painel titulo="Participação no volume recebido">
              {pesoGeral === 0 ? (
                <Vazio texto="Sem recebimento no período selecionado." />
              ) : (
                <div className="flex flex-col gap-3 px-4 py-4">
                  {resumo
                    .slice()
                    .sort((a, b) => b.peso - a.peso)
                    .map((r, i) => (
                      <Barra
                        key={r.tipo}
                        rotulo={formatar.materiaPrima(r.tipo)}
                        valor={`${formatar.porcento((r.peso / pesoGeral) * 100)} · ${formatar.kg(r.peso)}`}
                        proporcao={(r.peso / pesoGeral) * 100}
                        cor={i === 0 ? 'bg-mate-700' : 'bg-mate-300'}
                      />
                    ))}
                </div>
              )}
            </Painel>
          </div>

          <Aviso>
            Os valores desta tela são de leitura. Alterar preço aqui exigiria uma
            tabela de preços por tipo no banco, e a ervateira negocia o valor carga
            a carga — o preço entra na pesagem, em Recebimento, e é ajustado pela
            análise de qualidade, em Avaliações.
          </Aviso>

          {/* ------------------------- cargas do tipo ------------------------- */}
          <Painel
            className="mt-4"
            titulo={tipoAberto ? `Cargas · ${formatar.materiaPrima(tipoAberto)}` : 'Todas as cargas do período'}
            acao={tipoAberto ? (
              <button onClick={() => setTipoAberto(null)} className="font-semibold hover:underline">
                mostrar todos os tipos
              </button>
            ) : 'clique em um cartão para filtrar'}
          >
            <Tabela
              colunas={[
                { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
                { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.dataHora(c.dataHora) },
                { chave: 'produtor', titulo: 'Produtor', forte: true, render: (c) => c.produtor?.nome },
                { chave: 'tipo', titulo: 'Matéria-prima', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
                { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
                { chave: 'base', titulo: 'Preço base', alinhar: 'direita', render: (c) => formatar.precoKg(c.precoBaseKg) },
                {
                  chave: 'ajustado', titulo: 'Preço após análise', alinhar: 'direita',
                  render: (c) => c.analise
                    ? <span className={Number(c.analise.descontoPercentual) > 0 ? 'text-perigo' : ''}>
                        {formatar.precoKg(c.analise.precoAjustadoKg)}
                      </span>
                    : <span className="text-cinza-400">aguardando</span>,
                },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise?.valorTotal) },
                { chave: 'situacao', titulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
              ]}
              dados={cargasDoTipo}
              vazio={tipoAberto
                ? `Nenhuma carga de ${formatar.materiaPrima(tipoAberto).toLowerCase()} no período.`
                : 'Nenhuma carga registrada no período.'}
              rodape={<span>{cargasDoTipo.length} de {lista.length} cargas do período</span>}
            />
          </Painel>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Cartão de um tipo
// ---------------------------------------------------------------------------
// Um tipo sem movimento continua aparecendo, com o estado vazio explícito.
// Sumir da tela faria parecer que o tipo não existe no sistema.

function CartaoTipo({ resumo, participacao, aberto, aoAbrir }) {
  const vazio = resumo.cargas === 0

  return (
    <button
      type="button"
      onClick={aoAbrir}
      disabled={vazio}
      className={`rounded-[3px] border bg-white px-4 py-3 text-left transition-colors ${
        aberto ? 'border-mate-700 ring-1 ring-mate-700' : 'border-borda'
      } ${vazio ? 'opacity-60' : 'hover:border-mate-500'}`}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[11.5px] font-semibold text-tinta">
          {formatar.materiaPrima(resumo.tipo)}
        </span>
        {!vazio && <Etiqueta tom={aberto ? 'verde' : 'neutro'}>{formatar.porcento(participacao, 0)}</Etiqueta>}
      </span>

      {vazio ? (
        <span className="mt-3 block text-[10.5px] text-cinza-400">Sem recebimento no período.</span>
      ) : (
        <>
          <span className="mt-1 flex items-baseline gap-1 text-mate-700">
            <span className="text-2xl font-bold tabular">{formatar.numero(resumo.peso)}</span>
            <span className="text-[10px] font-medium text-cinza-400">kg</span>
          </span>
          <span className="mt-2 block h-[7px] w-full bg-cabecalho">
            <span className="block h-full bg-mate-500" style={{ width: `${Math.min(100, participacao)}%` }} />
          </span>
          <span className="mt-2.5 flex flex-col gap-1">
            {[
              ['Cargas', resumo.cargas],
              ['Preço base médio', formatar.precoKg(resumo.precoBaseMedio)],
              ['Após análise', formatar.precoKg(resumo.precoAjustadoMedio)],
              ['Valor analisado', resumo.valor ? formatar.reais(resumo.valor) : '—'],
            ].map(([r, v]) => (
              <span key={r} className="flex items-center gap-2">
                <span className="flex-1 text-[10px] text-cinza-400">{r}</span>
                <span className="text-[10.5px] font-semibold tabular text-tinta">{v}</span>
              </span>
            ))}
          </span>
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Contas do resumo
// ---------------------------------------------------------------------------
// Ficam fora do componente porque não dependem de estado nem de tela — e
// porque assim é possível conferi-las lendo trinta linhas, sem JSX no meio.

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
  const precos = doTipo.map((c) => Number(c.precoBaseKg)).filter((p) => !Number.isNaN(p))

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
