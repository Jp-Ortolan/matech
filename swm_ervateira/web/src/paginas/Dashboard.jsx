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
  sincronizacao as apiSincronizacao,
} from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Tabela, Indicador, Situacao, Barra, Medidor, Vazio, Aviso,
  Carregando, Erro, Botao
} from '../componentes/ui'
import { LIMITE_PALITO_PADRAO } from '../lib/calculo'
import { formatar, contagem } from '../lib/formatar'

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
  const { podeFazer } = useAutenticacao()

  // As mesmas perguntas que o servidor faz nas rotas, feitas antes de pedir.
  // Não é uma segunda autorização: se a tela pedisse mesmo assim, a resposta
  // seria 403 e o painel inteiro quebraria numa mensagem de erro. Perguntar
  // aqui é a diferença entre um painel menor e um painel que não abre.
  const veDinheiro = podeFazer('ADMINISTRATIVO')
  const veCampo = podeFazer('COMPRADOR_AVALIADOR')
  const veLaboratorio = podeFazer('ANALISTA_QUALIDADE')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // Tudo em paralelo: são consultas independentes, e encadeá-las somaria
      // as esperas sem nenhum ganho.
      const [janela, ordens, sincronia, ...contagens] = await Promise.all([
        apiCargas.listar({ porPagina: JANELA }),
        veDinheiro ? apiPagamentos.listar() : Promise.resolve(null),
        veCampo ? apiSincronizacao.resumo() : Promise.resolve(null),
        // Uma requisição por situação, pedindo uma linha só. O que interessa
        // é o `total` que vem junto — é o COUNT do banco.
        ...CICLO.map((e) => apiCargas.listar({ situacao: e.situacao, porPagina: 1 }).then((r) => r.total)),
      ])

      setDados({
        janela,
        ordens,
        sincronia,
        porSituacao: Object.fromEntries(CICLO.map((e, i) => [e.situacao, contagens[i]])),
      })
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [veDinheiro, veCampo])

  useEffect(() => { carregar() }, [carregar])

  if (carregando && !dados) return <Carregando texto="Apurando os números da operação..." />
  if (erro) return <Erro erro={erro} />
  if (!dados) return null

  const { janela, ordens, sincronia, porSituacao } = dados

  // ----------------------------- exatos -----------------------------
  const totalCargas = janela.total
  const aguardando = porSituacao.AGUARDANDO_ANALISE
  const reprovadas = porSituacao.REPROVADA
  const comAnalise = totalCargas - aguardando          // sai de AGUARDANDO só pela análise
  const aprovadas = comAnalise - reprovadas

  const listaOrdens = ordens?.ordens ?? []
  const ordensEmAberto = listaOrdens.filter((o) => o.situacao === 'PENDENTE')
  const valorEmAberto = Number(ordens?.totalEmAberto ?? 0)
  // Carga ANALISADA é, por definição, carga analisada e ainda fora de ordem:
  // ela vira EM_ORDEM_PAGAMENTO no instante em que entra numa. Então este
  // COUNT já é exatamente "pronta para pagar", sem consulta nova.
  const analisadasSemOrdem = porSituacao.ANALISADA

  // -------------------------------------------------------------------------
  // O QUE PRECISA DE VOCÊ HOJE
  // -------------------------------------------------------------------------
  // Filtrada pelo perfil, e pelas mesmas perguntas que decidiram o que buscar.
  // Um analista não precisa saber que há ordem por quitar, e o administrativo
  // não resolve amostra parada — mostrar as duas coisas para os dois é como
  // não mostrar nenhuma: vira um mural que ninguém lê.
  const pendencias = []

  if (veLaboratorio && aguardando > 0) {
    // `lista` vem ordenada da mais recente para a mais antiga, então a última
    // aguardando é a que está esperando há mais tempo.
    const naFila = lista.filter((c) => c.situacao === 'AGUARDANDO_ANALISE')
    const maisAntiga = naFila[naFila.length - 1]
    pendencias.push({
      chave: 'analise',
      titulo: `${contagem(aguardando, 'amostra aguarda', 'amostras aguardam')} análise`,
      detalhe: maisAntiga
        ? `a mais antiga chegou em ${formatar.dataHora(maisAntiga.dataHora)}, de ${maisAntiga.produtor?.nome}`
        : 'na fila do laboratório',
      acao: 'Lançar análise',
      para: '/avaliacoes',
      urgente: true,
    })
  }

  if (veDinheiro && analisadasSemOrdem > 0) {
    const prontas = lista.filter((c) => c.situacao === 'ANALISADA')
    const produtoresProntos = new Set(prontas.map((c) => c.produtor?.id ?? c.produtor?.nome)).size
    pendencias.push({
      chave: 'emitir',
      titulo: `${contagem(analisadasSemOrdem, 'carga analisada', 'cargas analisadas')} sem ordem de pagamento`,
      detalhe: produtoresProntos
        ? `${contagem(produtoresProntos, 'produtor', 'produtores')} à espera da emissão`
        : 'prontas para virar pagamento',
      acao: 'Emitir ordem',
      para: '/pagamentos',
      urgente: true,
    })
  }

  if (veDinheiro && ordensEmAberto.length > 0) {
    pendencias.push({
      chave: 'quitar',
      titulo: contagem(ordensEmAberto.length, 'ordem emitida e não quitada', 'ordens emitidas e não quitadas'),
      detalhe: `${formatar.reais(valorEmAberto)} a transferir`,
      acao: 'Confirmar pagamento',
      para: '/pagamentos',
      urgente: false,
    })
  }

  if (veCampo && sincronia?.pendentes > 0) {
    pendencias.push({
      chave: 'sincronizar',
      titulo: `${contagem(sincronia.pendentes, 'coleta ainda não chegou', 'coletas ainda não chegaram')} do aparelho`,
      detalhe: 'ficaram na fila de envio do celular',
      acao: 'Abrir sincronização',
      para: '/sincronizacao',
      urgente: false,
    })
  }

  if (veCampo && sincronia?.comErro > 0) {
    pendencias.push({
      chave: 'erro-sincronia',
      titulo: `${contagem(sincronia.comErro, 'coleta falhou', 'coletas falharam')} ao sincronizar`,
      detalhe: 'precisam de reenvio para não se perderem',
      acao: 'Ver o que falhou',
      para: '/sincronizacao',
      urgente: true,
    })
  }

  // O texto do vazio fala do trabalho de quem está olhando. Quem enxerga mais
  // de uma área — o administrativo e o administrador — recebe o geral.
  const areas = [veLaboratorio, veDinheiro, veCampo].filter(Boolean).length
  const vazioDasPendencias =
    areas > 1
      ? 'Nenhuma pendência na operação. Balança, laboratório e financeiro estão em dia.'
      : veLaboratorio
        ? 'Nenhuma amostra aguardando. Toda carga recebida já foi analisada.'
        : veDinheiro
          ? 'Nada a emitir nem a quitar. Toda carga analisada já entrou em ordem.'
          : veCampo
            ? 'Nada preso no aparelho. Tudo que foi coletado no erval já chegou.'
            : 'Nada parado com você. Toda carga pesada seguiu para o laboratório.'

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
  const comValor = analisadasNaJanela.filter(
    (c) => c.precoBaseKg != null && c.analise.precoAjustadoKg != null
  )
  const descontoEmReais = comValor.reduce(
    (s, c) => s + Number(c.pesoLiquidoKg) * (Number(c.precoBaseKg) - Number(c.analise.precoAjustadoKg)),
    0
  )


  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        subtitulo={`${contagem(totalCargas, 'carga', 'cargas')} desde o início`}
      >
        <Botao onClick={carregar} disabled={carregando}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </Botao>
        <Link to="/pesagem">
          <Botao variante="primario">Registrar pesagem</Botao>
        </Link>
      </CabecalhoPagina>

      {/* ---------------------- o que está parado ---------------------- */}
      {/* Três números, e só três. O painel antigo tinha oito cards do mesmo
          tamanho, e sete deles eram história: total recebido desde o início,
          produtores cadastrados, quanto já foi pago. História não pede nada de
          ninguém. Estes três pedem — e por isso levam para a tela onde a coisa
          se resolve. Quem quer o retrato completo tem os painéis abaixo. */}
      <div className="mb-3 flex flex-wrap gap-2">
        <NumeroDeAcao
          rotulo="Aguardando análise" valor={formatar.numero(aguardando)} unidade="cargas"
          apoio="na fila do laboratório"
          para={veLaboratorio ? '/avaliacoes' : null}
          cor={aguardando > 0 ? 'text-alerta' : 'text-tinta'}
        />
        <NumeroDeAcao
          rotulo="Analisadas sem ordem" valor={formatar.numero(analisadasSemOrdem)} unidade="cargas"
          apoio="prontas para virar pagamento"
          para={veDinheiro ? '/pagamentos' : null}
          cor={analisadasSemOrdem > 0 ? 'text-alerta' : 'text-tinta'}
        />
        {veDinheiro && (
          <NumeroDeAcao
            rotulo="Em aberto" valor={formatar.reais(valorEmAberto)}
            apoio={contagem(ordensEmAberto.length, 'ordem não quitada', 'ordens não quitadas')}
            para="/pagamentos"
            cor={valorEmAberto > 0 ? 'text-alerta' : 'text-tinta'}
          />
        )}
      </div>

      {/* ------------------- o que precisa de você hoje ------------------- */}
      <Painel className="mb-3" titulo="O que precisa de você hoje">
        <Pendencias
          pendencias={pendencias}
          vazio={vazioDasPendencias}
        />
      </Painel>

      {/* --------------------- ciclo da carga e matéria-prima --------------------- */}
      {/* items-start: sem isso a grade estica os dois painéis à mesma altura e o
          mais curto fica com um vão branco no meio. Alturas diferentes lado a lado
          são normais; espaço morto dentro de um cartão não é. */}
      <div className="mb-3 grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
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
                <div key={t.tipo} title={`${formatar.materiaPrima(t.tipo)}: ${formatar.kg(t.peso)} em ${contagem(t.cargas, 'carga', 'cargas')}`}>
                  <Barra
                    rotulo={`${formatar.materiaPrima(t.tipo)} · ${contagem(t.cargas, 'carga', 'cargas')}`}
                    valor={`${formatar.kg(t.peso)} · ${formatar.porcento((t.peso / pesoTotal) * 100)}`}
                    proporcao={(t.peso / pesoTotal) * 100}
                    cor="bg-mate-500"
                  />
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>

      {/* -------------------------- qualidade -------------------------- */}
      <Painel
        className="mb-3"
        titulo="Indicadores de qualidade"
        acao={<Link to="/relatorios">Abrir relatório</Link>}
      >
        {comAnalise === 0 ? (
          <Vazio texto={
            aguardando
              ? `Nenhuma análise lançada ainda. ${contagem(aguardando, 'carga aguarda', 'cargas aguardam')} o laboratório.`
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
              apoio={`O traço marca o limite de ${LIMITE_PALITO_PADRAO}%.`}
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
                    Desconto por qualidade concedido
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
      <Painel titulo="Últimas cargas recebidas" acao={<Link to="/pesagem">Abrir pesagem</Link>}>
        <Tabela
          colunas={[
            { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
            { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.dataHora(c.dataHora) },
            { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 220, render: (c) => c.produtor?.nome },
            { chave: 'tipo', titulo: 'Matéria-prima', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
            { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
            ...(veDinheiro
              ? [{ chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true, render: (c) => formatar.reais(c.analise?.valorTotal) }]
              : []),
            { chave: 'situacao', titulo: 'Situação', render: (c) => <Situacao valor={c.situacao} /> },
          ]}
          dados={lista.slice(0, 8)}
          vazio="Nenhuma carga registrada ainda."
          rodape={
            <>
              <span>{Math.min(8, lista.length)} de {totalCargas} cargas</span>
              <Link to="/pesagem" className="font-medium text-mate-700">Ver histórico</Link>
            </>
          }
        />
      </Painel>

      {!janelaCompleta && (
        <div className="mt-3">
          <Aviso tom="alerta">
            O histórico passou de {JANELA} cargas: peso recebido, distribuição e médias
            de qualidade cobrem as {lista.length} mais recentes. As contagens e os
            valores em ordens continuam exatos.
          </Aviso>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Número que leva a algum lugar
// ---------------------------------------------------------------------------
// Vira link quando o perfil pode abrir o destino, e continua sendo só um
// número quando não pode. Um card clicável que leva a um 403 é pior que um
// card quieto: promete uma saída que não existe.
function NumeroDeAcao({ para, ...indicador }) {
  if (!para) return <Indicador {...indicador} />
  return (
    <Link
      to={para}
      title={`Abrir ${indicador.rotulo.toLowerCase()}`}
      className="flex min-w-[132px] flex-1 rounded-[3px] transition-shadow hover:shadow-[0_0_0_1px_var(--color-mate-500)]"
    >
      <Indicador {...indicador} />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Lista de pendências
// ---------------------------------------------------------------------------
// Uma linha por coisa parada, com o que fazer escrito no fim dela. Não é uma
// tabela: tabela é para comparar linhas entre si, e aqui cada linha é um
// assunto diferente que só precisa ser lido e resolvido.
function Pendencias({ pendencias, vazio }) {
  if (!pendencias.length) return <Vazio texto={vazio} />

  return (
    <div className="flex flex-col divide-y divide-borda">
      {pendencias.map((p) => (
        <div key={p.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-[1px] ${p.urgente ? 'bg-alerta' : 'bg-mate-500'}`} />
          <div className="min-w-[220px] flex-1">
            <p className="text-[12.5px] font-semibold text-tinta">{p.titulo}</p>
            <p className="mt-0.5 text-[10.5px] text-cinza-600">{p.detalhe}</p>
          </div>
          <Link to={p.para} className="shrink-0 text-[11.5px] font-medium text-mate-700">
            {p.acao}
          </Link>
        </div>
      ))}
    </div>
  )
}
