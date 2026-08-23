// ---------------------------------------------------------------------------
// PÁGINA · painel administrativo
// ---------------------------------------------------------------------------
// Visão geral da operação inteira, desde o início. Não há filtro de período
// aqui de propósito: misturar contagens do histórico com somas de um recorte
// deixaria a tela dizendo duas coisas ao mesmo tempo. Quem precisa de recorte
// vai em Relatórios, que existe para isso.
//
// DE ONDE VEM CADA NÚMERO — e por que sete deles são exatos e três não são:
//
// A rota de cargas devolve { total, pagina, porPagina, cargas }. O `total` vem
// de um COUNT no PostgreSQL, dentro da mesma transação da consulta; a lista
// `cargas` vem paginada. São coisas diferentes, e a diferença importa:
//
//   · CONTAR         → pedir porPagina=1 e ler só o `total`. O banco conta.
//                      Exato com 3 cargas e exato com trinta mil.
//   · SOMAR e AGRUPAR→ precisa das linhas. E linha só vem paginada, com teto
//                      de 500. Então peso total, distribuição por tipo e as
//                      médias de qualidade são calculados sobre as 500 cargas
//                      mais recentes.
//
// Enquanto o total couber na janela, os dois caminhos dão o mesmo número. Ao
// passar de 500, os três da segunda lista passariam a mentir em silêncio — por
// isso a tela avisa, em vez de fingir que o número continua completo. A saída
// definitiva é uma rota de resumo que faça SUM e GROUP BY no banco.
//
// Contagem de análises sem precisar da janela: uma carga só sai de
// AGUARDANDO_ANALISE quando alguém lança a análise. Logo, analisadas é
// exatamente total − aguardando, e aprovadas é total − aguardando − reprovadas.
//
// SOBRE OS GRÁFICOS: todas as barras são de uma cor só. A identidade de cada
// linha está no rótulo escrito ao lado dela, nunca na cor — o conjunto de cores
// de situação do sistema reprova em daltonismo (o verde escuro e o vermelho
// ficam a ΔE 2,1 em protanopia), então usá-las para diferenciar séries deixaria
// o gráfico ilegível para parte dos leitores. Cor aqui carrega severidade, e só.

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  cargas as apiCargas,
  pagamentos as apiPagamentos,
  produtores as apiProdutores,
} from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Tabela, Indicador, Situacao, Barra, Medidor, Vazio, Aviso,
  Carregando, Erro, Botao, formatar,
} from '../componentes/ui'
import { LIMITE_PALITO_PADRAO } from '../lib/calculo'

// Teto do porPagina no servidor. A janela usada para somar e agrupar.
const JANELA = 500

// A ordem é a do ciclo real da carga, não a do enum.
const CICLO = [
  { situacao: 'AGUARDANDO_ANALISE', rotulo: 'Aguardando análise', onde: 'na fila do laboratório' },
  { situacao: 'ANALISADA', rotulo: 'Analisada', onde: 'liberada para pagamento' },
  { situacao: 'EM_ORDEM_PAGAMENTO', rotulo: 'Em ordem de pagamento', onde: 'aguardando a transferência' },
  { situacao: 'PAGA', rotulo: 'Paga', onde: 'ciclo encerrado' },
  { situacao: 'REPROVADA', rotulo: 'Reprovada', onde: 'fora do padrão na análise' },
]

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // Tudo em paralelo: são consultas independentes, e encadeá-las somaria
      // as esperas sem nenhum ganho.
      const [janela, ordens, produtores, ...contagens] = await Promise.all([
        apiCargas.listar({ porPagina: JANELA }),
        apiPagamentos.listar(),
        apiProdutores.listar(),
        // Uma requisição por situação, pedindo uma linha só. O que interessa
        // é o `total` que vem junto — é o COUNT do banco.
        ...CICLO.map((e) => apiCargas.listar({ situacao: e.situacao, porPagina: 1 }).then((r) => r.total)),
      ])

      setDados({
        janela,
        ordens,
        produtores,
        porSituacao: Object.fromEntries(CICLO.map((e, i) => [e.situacao, contagens[i]])),
      })
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando && !dados) return <Carregando texto="Apurando os números da operação..." />
  if (erro) return <Erro erro={erro} />
  if (!dados) return null

  const { janela, ordens, produtores, porSituacao } = dados

  // ----------------------------- exatos -----------------------------
  const totalCargas = janela.total
  const totalProdutores = produtores.total
  const aguardando = porSituacao.AGUARDANDO_ANALISE
  const reprovadas = porSituacao.REPROVADA
  const comAnalise = totalCargas - aguardando          // sai de AGUARDANDO só pela análise
  const aprovadas = comAnalise - reprovadas

  const listaOrdens = ordens.ordens ?? []
  const ordensPagas = listaOrdens.filter((o) => o.situacao === 'PAGA')
  const valorEmOrdens = listaOrdens.reduce((s, o) => s + Number(o.valorTotal), 0)
  const valorPago = ordensPagas.reduce((s, o) => s + Number(o.valorTotal), 0)

  // -------------------- calculados sobre a janela --------------------
  const lista = janela.cargas ?? []
  const janelaCompleta = lista.length >= totalCargas
  const pesoTotal = lista.reduce((s, c) => s + Number(c.pesoLiquidoKg), 0)

  const porTipo = Object.entries(
    lista.reduce((acc, c) => {
      acc[c.tipoMateriaPrima] = acc[c.tipoMateriaPrima] || { peso: 0, cargas: 0 }
      acc[c.tipoMateriaPrima].peso += Number(c.pesoLiquidoKg)
      acc[c.tipoMateriaPrima].cargas += 1
      return acc
    }, {})
  )
    .map(([tipo, v]) => ({ tipo, ...v }))
    .sort((a, b) => b.peso - a.peso)

  const analisadasNaJanela = lista.filter((c) => c.analise)
  const palitoMedio = analisadasNaJanela.length
    ? analisadasNaJanela.reduce((s, c) => s + Number(c.analise.palitoPercentual), 0) / analisadasNaJanela.length
    : null
  const acimaDoLimite = analisadasNaJanela.filter(
    (c) => Number(c.analise.palitoPercentual) > Number(c.analise.limitePalito)
  ).length
  const descontoEmReais = analisadasNaJanela.reduce(
    (s, c) => s + Number(c.pesoLiquidoKg) * (Number(c.precoBaseKg) - Number(c.analise.precoAjustadoKg)),
    0
  )


  return (
    <>
      <CabecalhoPagina
        titulo="Painel administrativo"
        subtitulo={`Como está a operação agora · ${totalCargas} ${totalCargas === 1 ? 'carga' : 'cargas'} desde o início`}
      >
        <Botao onClick={carregar} disabled={carregando}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </Botao>
        <Link to="/pesagem">
          <Botao variante="primario">Registrar pesagem</Botao>
        </Link>
      </CabecalhoPagina>

      {/* ------------------------- volume e cadastro ------------------------- */}
      <div className="mb-3 flex flex-wrap gap-2 xl:gap-3">
        <Indicador
          rotulo="Cargas recebidas" valor={formatar.numero(totalCargas)} unidade="cargas"
          apoio="contagem no banco, histórico completo" cor="text-mate-700"
        />
        <Indicador
          rotulo="Matéria-prima recebida" valor={formatar.numero(pesoTotal)} unidade="kg"
          apoio={janelaCompleta ? 'peso líquido, histórico completo' : `peso líquido das ${lista.length} cargas mais recentes`}
          cor="text-mate-700"
        />
        <Indicador
          rotulo="Produtores cadastrados" valor={formatar.numero(totalProdutores)} unidade="produtores"
          apoio={`${produtores.produtores.filter((p) => p.criadoOffline).length} vieram do aplicativo`}
        />
        <Indicador
          rotulo="Valor total em ordens" valor={formatar.reais(valorEmOrdens)}
          apoio={`${listaOrdens.length} ${listaOrdens.length === 1 ? 'ordem emitida' : 'ordens emitidas'}`}
          cor="text-mate-700"
        />
      </div>

      {/* ------------------------- fila e pagamento ------------------------- */}
      <div className="mb-4 flex flex-wrap gap-2 xl:gap-3">
        <Indicador
          rotulo="Aguardando análise" valor={formatar.numero(aguardando)} unidade="cargas"
          apoio="paradas na fila do laboratório" cor={aguardando > 0 ? 'text-alerta' : 'text-tinta'}
        />
        <Indicador
          rotulo="Cargas analisadas" valor={formatar.numero(comAnalise)} unidade={`de ${totalCargas}`}
          apoio={`${aprovadas} aprovadas · ${reprovadas} reprovadas`} cor="text-mate-700"
        />
        <Indicador
          rotulo="Pagamentos emitidos" valor={formatar.numero(listaOrdens.length)} unidade="ordens"
          apoio={`${ordensPagas.length} quitadas · ${listaOrdens.length - ordensPagas.length} em aberto`}
        />
        <Indicador
          rotulo="Pago aos produtores" valor={formatar.reais(valorPago)}
          apoio={`${formatar.reais(ordens.totalEmAberto ?? 0)} ainda em aberto`} cor="text-mate-700"
        />
      </div>

      {/* --------------------- ciclo da carga e matéria-prima --------------------- */}
      {/* items-start: sem isso a grade estica os dois painéis à mesma altura e o
          mais curto fica com um vão branco no meio. Alturas diferentes lado a lado
          são normais; espaço morto dentro de um cartão não é. */}
      <div className="mb-4 grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <Painel titulo="Ciclo da carga" acao="contagem exata por situação" className="flex flex-col">
          {totalCargas === 0 ? (
            <Vazio texto="Nenhuma carga registrada ainda." />
          ) : (
            <div className="flex flex-col gap-3 px-4 py-4">
              {CICLO.map((etapa) => {
                const quantidade = porSituacao[etapa.situacao]
                return (
                  <div key={etapa.situacao} title={`${etapa.rotulo}: ${quantidade} de ${totalCargas} cargas`}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="flex-1"><Situacao valor={etapa.situacao} /></span>
                      <span className="text-[10px] text-cinza-400">{etapa.onde}</span>
                      <span className="w-[86px] shrink-0 text-right text-[11.5px] font-semibold tabular text-tinta">
                        {quantidade} · {formatar.porcento((quantidade / totalCargas) * 100, 0)}
                      </span>
                    </div>
                    <div className="h-[7px] w-full bg-cabecalho">
                      <div className="h-full bg-mate-500" style={{ width: `${(quantidade / totalCargas) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-auto border-t border-borda px-4 py-2.5">
            <p className="text-[10px] text-cinza-400">
              Cada barra mede a fatia daquela etapa sobre as {totalCargas} cargas do
              histórico — o comprimento e o percentual ao lado dizem a mesma coisa.
              Uma carga só sai de "em avaliação" quando o laboratório lança a análise.
            </p>
          </div>
        </Painel>

        <Painel
          titulo="Distribuição por matéria-prima"
          acao={janelaCompleta ? `${formatar.kg(pesoTotal)} no total` : `${lista.length} cargas mais recentes`}
          className="flex flex-col"
        >
          {porTipo.length === 0 ? (
            <Vazio texto="Nenhuma carga registrada ainda." />
          ) : (
            <div className="flex flex-col gap-3 px-4 py-4">
              {porTipo.map((t) => (
                <div key={t.tipo} title={`${formatar.materiaPrima(t.tipo)}: ${formatar.kg(t.peso)} em ${t.cargas} ${t.cargas === 1 ? 'carga' : 'cargas'}`}>
                  <Barra
                    rotulo={`${formatar.materiaPrima(t.tipo)} · ${t.cargas} ${t.cargas === 1 ? 'carga' : 'cargas'}`}
                    valor={`${formatar.kg(t.peso)} · ${formatar.porcento((t.peso / pesoTotal) * 100)}`}
                    proporcao={(t.peso / pesoTotal) * 100}
                    cor="bg-mate-500"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-auto border-t border-borda px-4 py-2.5">
            <p className="text-[10px] text-cinza-400">
              Peso líquido por tipo, como fatia do total recebido. Os quatro tipos vêm
              do enum TipoMateriaPrima; aparecem aqui apenas os que tiveram recebimento.
            </p>
          </div>
        </Painel>
      </div>

      {/* -------------------------- qualidade -------------------------- */}
      <Painel
        className="mb-4"
        titulo="Indicadores de qualidade"
        acao={<Link to="/relatorios">Abrir relatório de qualidade</Link>}
      >
        {comAnalise === 0 ? (
          <Vazio texto={
            aguardando
              ? `Nenhuma análise lançada ainda. ${aguardando} ${aguardando === 1 ? 'carga aguarda' : 'cargas aguardam'} o laboratório.`
              : 'Nenhuma carga registrada ainda.'
          } />
        ) : (
          <div className="grid grid-cols-1 gap-5 px-4 py-4 lg:grid-cols-[320px_1fr]">
            <Medidor
              rotulo="Palito médio nas análises"
              texto={formatar.porcento(palitoMedio)}
              valor={palitoMedio}
              maximo={50}
              limite={LIMITE_PALITO_PADRAO}
              alerta={palitoMedio > LIMITE_PALITO_PADRAO}
              apoio={`O traço marca o limite acordado de ${LIMITE_PALITO_PADRAO}%. Acima dele, cada ponto percentual excedente desconta 1% do preço.`}
            />

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                ['Análises lançadas', formatar.numero(comAnalise), `de ${totalCargas} cargas`, 'text-tinta'],
                ['Aprovadas', formatar.numero(aprovadas), `${formatar.porcento((aprovadas / comAnalise) * 100, 0)} das analisadas`, 'text-mate-700'],
                ['Reprovadas', formatar.numero(reprovadas), 'fora do padrão', reprovadas > 0 ? 'text-perigo' : 'text-tinta'],
                ['Acima do limite', formatar.numero(acimaDoLimite), 'geraram desconto', acimaDoLimite > 0 ? 'text-alerta' : 'text-tinta'],
              ].map(([rotulo, valor, apoio, cor]) => (
                <div key={rotulo}>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">{rotulo}</p>
                  <p className={`mt-0.5 text-xl font-bold tabular ${cor}`}>{valor}</p>
                  <p className="mt-0.5 text-[10px] text-cinza-600">{apoio}</p>
                </div>
              ))}

              <div className="col-span-2 sm:col-span-4">
                <div className="flex items-center gap-2 rounded-[3px] bg-cabecalho px-3 py-2.5">
                  <span className="flex-1 text-[11px] text-cinza-600">
                    Desconto por qualidade concedido {janelaCompleta ? 'no histórico' : `nas ${lista.length} cargas mais recentes`}
                  </span>
                  <span className="text-[13px] font-bold tabular text-perigo">
                    −{formatar.reais(descontoEmReais)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Painel>

      {/* ------------------------ últimas cargas ------------------------ */}
      <Painel titulo="Últimas cargas recebidas" acao={<Link to="/pesagem">Abrir recebimento</Link>}>
        <Tabela
          colunas={[
            { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
            { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.dataHora(c.dataHora) },
            { chave: 'produtor', titulo: 'Produtor', forte: true, render: (c) => c.produtor?.nome },
            { chave: 'tipo', titulo: 'Matéria-prima', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
            { chave: 'motorista', titulo: 'Motorista', render: (c) => c.motorista?.nome || '—' },
            { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
            { chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise?.valorTotal) },
            { chave: 'situacao', titulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
          ]}
          dados={lista.slice(0, 8)}
          vazio="Nenhuma carga registrada ainda. A primeira entra pela tela de Recebimento."
          rodape={
            <>
              <span>Mostrando {Math.min(8, lista.length)} de {totalCargas} cargas</span>
              <Link to="/pesagem" className="font-medium text-mate-700">Ver histórico completo</Link>
            </>
          }
        />
      </Painel>

      {!janelaCompleta && (
        <div className="mt-3">
          <Aviso tom="alerta">
            O histórico passou de {JANELA} cargas. Peso recebido, distribuição por
            matéria-prima e as médias de qualidade acima foram calculados sobre as{' '}
            {lista.length} cargas mais recentes — as contagens e os valores em ordens
            continuam exatos, porque vêm de contagem no banco. Para que as somas voltem
            a cobrir o histórico inteiro é preciso uma rota de resumo que faça SUM e
            GROUP BY no PostgreSQL, em vez de somar linha a linha no navegador.
          </Aviso>
        </div>
      )}
    </>
  )
}
