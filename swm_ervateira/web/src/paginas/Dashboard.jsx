// ---------------------------------------------------------------------------
// PÁGINA · painel administrativo
// ---------------------------------------------------------------------------
// Visão geral da operação inteira, desde o início. Não há filtro de período
// aqui de propósito: misturar contagens do histórico com somas de um recorte
// deixaria a tela dizendo duas coisas ao mesmo tempo. Quem precisa de recorte
// vai em Relatórios, que existe para isso.
//
// UMA REQUISIÇÃO, e todos os números exatos.
//
// Esta tela já foi outra coisa. Ela fazia sete requisições — uma janela de 500
// cargas, cinco contagens e as ordens — e somava as 500 linhas aqui, em
// JavaScript. Funcionava, e tinha um defeito que crescia sozinho: a partir da
// carga 501, peso recebido, distribuição por matéria-prima e médias de
// qualidade passavam a cobrir só as mais recentes. A tela avisava disso num
// rodapé amarelo, o que é a definição de um painel que não se pode usar para
// decidir nada.
//
// Agora quem soma é o PostgreSQL, em GET /api/dashboard, com GROUP BY sobre a
// tabela inteira. Sumiram: as sete requisições, a constante JANELA, o aviso
// amarelo e a possibilidade de o número estar errado.
//
// SOBRE OS GRÁFICOS: todas as barras são de uma cor só. A identidade de cada
// linha está no rótulo escrito ao lado dela, nunca na cor — o conjunto de
// cores de situação do sistema reprova em daltonismo (o verde escuro e o
// vermelho ficam a ΔE 2,1 em protanopia), então usá-las para diferenciar
// séries deixaria o gráfico ilegível para parte dos leitores. Cor aqui carrega
// severidade, e só.

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  dashboard as apiDashboard,
} from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  FaixaDeIndicadores, Painel, Tabela, Indicador, Situacao, Barra, Medidor, Vazio, Aviso,
  Carregando, Erro, Botao
} from '../componentes/ui'
import { formatar, contagem } from '../lib/formatar'
import { ICONE_DA_ACAO, ICONE_DA_GRANDEZA } from '../lib/icones'
import { colunasDeCargas } from '../componentes/tabelas'

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

  // As mesmas perguntas que o servidor faz, feitas aqui só para decidir o que
  // DESENHAR. Quem decide o que vem no corpo da resposta é a rota: o painel de
  // quem não vê dinheiro chega sem ordens e sem desconto, porque as consultas
  // nem rodaram.
  const veDinheiro = podeFazer('ADMINISTRATIVO')
  const veLaboratorio = podeFazer('ANALISTA_QUALIDADE')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await apiDashboard.carregar())
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

  const { totais, porSituacao, porTipo, qualidade, ultimasCargas, ordens, descontoEmReais } = dados

  // Nenhuma conta aqui embaixo, e é essa a mudança. O que existe são nomes
  // curtos para o que a resposta já trouxe pronto — todos exatos, todos sobre
  // a tabela inteira.
  const totalCargas = totais.cargas
  const pesoTotal = totais.pesoLiquidoKg

  const aguardando = porSituacao.AGUARDANDO_ANALISE
  const analisadasSemOrdem = porSituacao.ANALISADA
  const reprovadas = qualidade.reprovadas
  const comAnalise = qualidade.analises
  const aprovadas = qualidade.aprovadas
  const palitoMedio = qualidade.palitoMedio
  const acimaDoLimite = qualidade.acimaDoLimite
  // O limite vem da régua da ervateira, e não mais de uma constante do front:
  // ele é configurável em Configurações desde que os limites saíram do código.
  const limitePalito = qualidade.limitePalito

  const valorEmAberto = ordens?.valorEmAberto ?? 0
  const ordensEmAberto = ordens?.ordensEmAberto ?? 0

  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        subtitulo={`${contagem(totalCargas, 'carga', 'cargas')} desde o início`}
      >
        <Botao onClick={carregar} disabled={carregando} icone={ICONE_DA_ACAO.atualizar}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </Botao>
        <Link to="/pesagem">
          <Botao variante="primario" icone={ICONE_DA_ACAO.registrar}>Registrar pesagem</Botao>
        </Link>
      </CabecalhoPagina>

      {/* ---------------------- o que está parado ---------------------- */}
      {/* Três números, e só três. O painel antigo tinha oito cards do mesmo
          tamanho, e sete deles eram história: total recebido desde o início,
          produtores cadastrados, quanto já foi pago. História não pede nada de
          ninguém. Estes três pedem — e por isso levam para a tela onde a coisa
          se resolve. Quem quer o retrato completo tem os painéis abaixo. */}
      <FaixaDeIndicadores>
        <NumeroDeAcao
          rotulo="Aguardando análise" icone={ICONE_DA_GRANDEZA.espera} valor={formatar.numero(aguardando)} unidade="cargas"
          apoio="na fila do laboratório"
          vazio={aguardando === 0 ? 'nenhuma carga na fila' : null}
          para={veLaboratorio ? '/avaliacoes' : null}
          cor={aguardando > 0 ? 'text-alerta' : 'text-tinta'}
        />
        <NumeroDeAcao
          rotulo="Analisadas sem ordem" icone={ICONE_DA_GRANDEZA.cargas} valor={formatar.numero(analisadasSemOrdem)} unidade="cargas"
          apoio="prontas para virar pagamento"
          vazio={analisadasSemOrdem === 0 ? 'tudo já virou pagamento' : null}
          para={veDinheiro ? '/pagamentos' : null}
          cor={analisadasSemOrdem > 0 ? 'text-alerta' : 'text-tinta'}
        />
        {veDinheiro && (
          <NumeroDeAcao
            rotulo="Em aberto" icone={ICONE_DA_GRANDEZA.dinheiro} valor={formatar.reais(valorEmAberto)}
            apoio={contagem(ordensEmAberto, 'ordem não quitada', 'ordens não quitadas')}
            vazio={valorEmAberto === 0 ? 'nada em aberto' : null}
            para="/pagamentos"
            cor={valorEmAberto > 0 ? 'text-alerta' : 'text-tinta'}
          />
        )}
      </FaixaDeIndicadores>

      {/* --------------------- ciclo da carga e matéria-prima --------------------- */}
      {/* items-start: sem isso a grade estica os dois painéis à mesma altura e o
          mais curto fica com um vão branco no meio. Alturas diferentes lado a lado
          são normais; espaço morto dentro de um cartão não é. */}
      {/* lg: e não só xl: — em 1024px, que é um tablet deitado, os dois painéis
          já cabem lado a lado. Antes eles só se separavam em 1280, e um tablet
          ficava com a mesma coluna única de um celular. */}
      <div className="mb-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
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
          acao={`${formatar.kg(pesoTotal)} no total`}
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
        className="mb-6"
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
              limite={limitePalito}
              alerta={palitoMedio > limitePalito}
              apoio={`O traço marca o limite de ${formatar.porcento(limitePalito, 0)} definido na régua.`}
            />

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                ['Análises lançadas', formatar.numero(comAnalise), `de ${totalCargas} cargas`, 'text-tinta'],
                // Aprovada é o caso NORMAL, e caso normal não é destaque: o
                // verde aqui punha o número esperado no mesmo peso do número
                // que pede atenção, dois quadros ao lado.
                ['Aprovadas', formatar.numero(aprovadas), `${formatar.porcento((aprovadas / comAnalise) * 100, 0)} das analisadas`, 'text-tinta'],
                ['Reprovadas', formatar.numero(reprovadas), 'fora do padrão', reprovadas > 0 ? 'text-perigo' : 'text-tinta'],
                ['Acima do limite', formatar.numero(acimaDoLimite), 'geraram desconto', acimaDoLimite > 0 ? 'text-alerta' : 'text-tinta'],
              ].map(([rotulo, valor, apoio, cor]) => (
                <div key={rotulo}>
                  <p className="text-[11px] font-semibold text-cinza-600">{rotulo}</p>
                  <p className={`mt-0.5 text-xl font-bold tabular ${cor}`}>{valor}</p>
                  <p className="mt-0.5 text-[10px] text-cinza-600">{apoio}</p>
                </div>
              ))}

              {veDinheiro && (
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
              )}
            </div>
          </div>
        )}
      </Painel>

      {/* ------------------------ últimas cargas ------------------------ */}
      {/* CINCO LINHAS, e nem uma a mais.
          
          Esta lista não é a lista de cargas — a lista de cargas é a Pesagem.
          Aqui ela responde a outra pergunta, muito menor: "chegou alguma coisa
          hoje?". Cinco linhas respondem isso; oito só ocupam mais tela dizendo
          a mesma coisa, e ainda fazem o painel parecer uma segunda Pesagem.
          
          As colunas vêm no formato compacto: sem data, sem tipo, sem motivo de
          reprovação. Quem precisa de qualquer um dos três está numa pergunta
          diferente, e para essa há um link logo ali. */}
      <Painel titulo="Últimas cargas recebidas" acao={<Link to="/pesagem">Ver todas</Link>}>
        <Tabela
          colunas={colunasDeCargas({ veDinheiro, compacta: true })}
          dados={ultimasCargas}
          vazio="Nenhuma carga registrada ainda."
          rodape={
            <>
              <span>{ultimasCargas.length} de {formatar.numero(totalCargas)} cargas</span>
              <Link to="/pesagem" className="font-medium text-mate-700">Abrir pesagem</Link>
            </>
          }
        />
      </Painel>

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
      // O indicador perdeu a caixa, então o realce de clicável também não pode
      // mais ser uma caixa. Sublinhar o rótulo é o sinal que sobrou — e é o
      // mesmo que qualquer link usa, o que dispensa explicação.
      className="group flex min-w-[140px] flex-1 [&_p:first-child]:hover:text-mate-700 [&_p:first-child]:hover:underline [&_p:first-child]:hover:underline-offset-2"
    >
      <Indicador {...indicador} />
    </Link>
  )
}
