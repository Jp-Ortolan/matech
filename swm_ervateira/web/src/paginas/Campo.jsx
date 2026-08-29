// ---------------------------------------------------------------------------
// PÁGINA · avaliações de campo
// ---------------------------------------------------------------------------
// O que o aplicativo coletou no erval, visto do escritório.
//
// Esta tela é a outra metade do trabalho. Sem ela, a única forma de conferir
// uma sincronização seria abrir o banco de dados — e o diferencial do sistema,
// que é a coleta em campo funcionando sem conexão, ficaria invisível para
// quem usa. O que não aparece na tela, para a empresa, não existe.
//
// Duas metades, como na tela de análise: a lista à esquerda, o detalhe à
// direita. A foto ocupa espaço de propósito — ela é a prova do que o avaliador
// viu, e uma miniatura de 40 pixels não prova nada sobre folha, talo ou queima.

import { useCallback, useEffect, useState } from 'react'
import { avaliacoesCampo, produtores as apiProdutores, sincronizacao } from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  FaixaDeIndicadores, Painel, Filtros, Tabela, Janela, Indicador, Campo, Selecao, Botao, Etiqueta, LinhaDado,
  Barra, Carregando, Erro, Vazio
} from '../componentes/ui'
import { formatar } from '../lib/formatar'
import { ICONE_DA_ACAO, ICONE_DA_GRANDEZA } from '../lib/icones'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

const ROTULO_ENTIDADE = {
  Produtor: 'Produtor',
  Erval: 'Área de colheita',
  Avaliacao: 'Avaliação',
  FotoErval: 'Foto',
}

const ROTULO_ERVA = { NATIVA: 'Nativa', PLANTADA: 'Plantada' }
const ROTULO_QUEIMA = { NAO: 'Sem queima', EM_PARTE: 'Queimada em parte', SIM: 'Queimada' }

export default function CampoPagina() {
  const [filtros, setFiltros] = useState({ produtorId: '', de: '', ate: '', comFoto: '' })
  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [sincronia, setSincronia] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await avaliacoesCampo.listar({ ...filtros, porPagina: 100 }))
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => { buscar() }, [buscar])

  useEffect(() => {
    apiProdutores.listar().then((r) => setListaProdutores(r.produtores)).catch(() => {})
  }, [])

  // O resumo da sincronização vive aqui desde que a tela própria saiu do menu.
  // Faz sentido: a pergunta "chegou tudo o que foi coletado?" só existe por
  // causa desta tela, e antes obrigava a trocar de página para ser respondida.
  useEffect(() => {
    sincronizacao.resumo().then(setSincronia).catch(() => setSincronia(null))
  }, [])

  async function abrir(linha) {
    // Busca o detalhe em vez de reaproveitar a linha da lista: o detalhe traz
    // as cargas que nasceram desta avaliação, que a listagem não carrega.
    setSelecionada(await avaliacoesCampo.buscar(linha.id))
  }

  if (erro) return <Erro erro={erro} />

  return (
    <>
      <CabecalhoPagina titulo="Avaliações de campo">
        <Botao onClick={buscar} icone={ICONE_DA_ACAO.atualizar}>Atualizar</Botao>
      </CabecalhoPagina>

      <Filtros
        ativos={resumirFiltros(filtros, {
          produtorId: (v) => nomeNaLista(listaProdutores, v),
          de: (v) => `De ${formatar.data(v)}`,
          ate: (v) => `Até ${formatar.data(v)}`,
          comFoto: () => 'Com foto',
        })}
        aoRemover={(chave) => setFiltros({ ...filtros, [chave]: '' })}
        aoLimpar={() => setFiltros({ produtorId: '', de: '', ate: '', comFoto: '' })}
      >
        <Selecao
          rotulo="Produtor"
          className="flex-[2]"
          value={filtros.produtorId}
          onChange={(e) => setFiltros({ ...filtros, produtorId: e.target.value })}
        >
          <option value="">Todos os produtores</option>
          {listaProdutores.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </Selecao>
        <Campo
          rotulo="De"
          type="date"
          className="flex-1"
          value={filtros.de}
          onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
        />
        <Campo
          rotulo="Até"
          type="date"
          className="flex-1"
          value={filtros.ate}
          onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
        />
        <Selecao
          rotulo="Fotos"
          className="flex-1"
          value={filtros.comFoto}
          onChange={(e) => setFiltros({ ...filtros, comFoto: e.target.value })}
        >
          <option value="">Todas</option>
          <option value="true">Com foto</option>
        </Selecao>
      </Filtros>

      <FaixaDeIndicadores>
        <Indicador rotulo="Avaliações" icone={ICONE_DA_GRANDEZA.qualidade} valor={dados?.total ?? '—'} apoio="no período" />
        <Indicador
          rotulo="Coletadas offline" icone={ICONE_DA_GRANDEZA.offline}
          valor={dados?.coletadasEmCampo ?? '—'}
          apoio="sem conexão no erval"
        />
        <Indicador rotulo="Com foto" icone={ICONE_DA_GRANDEZA.foto} valor={dados?.comFotos ?? '—'} apoio="prova visual" />
        <Indicador
          rotulo="Sincronização" icone={ICONE_DA_GRANDEZA.sincronia}
          valor={sincronia?.taxaSincronizacao != null ? `${formatar.numero(sincronia.taxaSincronizacao, 1)}%` : '—'}
          apoio="confirmados ÷ total coletado"
        />
      </FaixaDeIndicadores>

      <ResumoDaSincronizacao sincronia={sincronia} />

      {/* A lista ocupa a largura toda: o detalhe saiu da coluna ao lado e
          passou a abrir numa janela. Com a coluna, o detalhe de uma avaliação
          — cinco blocos empilhados — ficava muito mais alto que uma lista de
          duas linhas, e ler até o fim exigia rolar até um ponto em que a
          metade esquerda estava vazia. */}
      <Painel titulo="Coletadas" acao={`${dados?.avaliacoes.length ?? 0} na lista`}>
          {carregando ? (
            <Carregando />
          ) : (
            <Tabela
              colunas={[
                { chave: 'dataAvaliacao', titulo: 'Data', render: (a) => formatar.dataHora(a.dataAvaliacao) },
                { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 170, render: (a) => a.erval?.produtor?.nome },
                { chave: 'erval', titulo: 'Área', truncar: 130, render: (a) => a.erval?.identificacao },
                { chave: 'quantidade', titulo: 'Estimado', alinhar: 'direita', render: (a) => formatar.kg(a.quantidadeEstimadaKg) },
                {
                  chave: 'prova',
                  titulo: 'Prova',
                  render: (a) => (
                    <span className="flex gap-1">
                      {a.fotos?.length > 0 && <Etiqueta tom="verde">{a.fotos.length} foto{a.fotos.length > 1 ? 's' : ''}</Etiqueta>}
                      {a.latitude != null && <Etiqueta>GPS</Etiqueta>}
                      {a.criadoOffline && <Etiqueta tom="alerta">offline</Etiqueta>}
                    </span>
                  ),
                },
              ]}
              dados={dados?.avaliacoes ?? []}
              aoClicarLinha={abrir}
              linhaAtiva={selecionada?.id}
              vazio="Nenhuma avaliação de campo neste período."
            />
          )}
      </Painel>

      {selecionada && (
        <Janela
          titulo={selecionada.erval?.produtor?.nome || 'Avaliação de campo'}
          subtitulo={`${selecionada.erval?.identificacao ?? 'sem área'} · ${formatar.dataHora(selecionada.dataAvaliacao)}`}
          aoFechar={() => setSelecionada(null)}
        >
          <Detalhe avaliacao={selecionada} />
        </Janela>
      )}
    </>
  )
}

function Detalhe({ avaliacao: a }) {
  const s = a.sincronizacao

  return (
    <div className="space-y-3">
      <Painel
        titulo={a.erval?.produtor?.nome ?? 'Avaliação'}
        acao={formatar.dataHora(a.dataAvaliacao)}
      >
        <div className="grid grid-cols-2 gap-3 px-3 py-3 md:grid-cols-3">
          <LinhaDado rotulo="Área" valor={a.erval?.identificacao} />
          <LinhaDado rotulo="Tipo de erva" valor={ROTULO_ERVA[a.tipoErva] || a.tipoErva} />
          <LinhaDado rotulo="Erva queimada" valor={ROTULO_QUEIMA[a.ervaQueimada] || a.ervaQueimada} />
          <LinhaDado rotulo="Quantidade estimada" valor={formatar.kg(a.quantidadeEstimadaKg)} />
          <LinhaDado rotulo="Idade do erval" valor={a.idadeErvalAnos ? `${a.idadeErvalAnos} anos` : null} />
          <LinhaDado
            rotulo="Valor combinado"
            valor={a.valorCombinadoKg ? `${formatar.reais(a.valorCombinadoKg)}/kg` : null}
          />
          <LinhaDado rotulo="Avaliador" valor={a.usuario?.nome} className="col-span-2" />
          <LinhaDado
            rotulo="Coordenada"
            valor={a.latitude != null ? `${Number(a.latitude).toFixed(6)}, ${Number(a.longitude).toFixed(6)}` : null}
          />
        </div>

        {a.observacoes && (
          <div className="border-t border-borda px-4 py-3">
            <p className="text-[11px] font-semibold text-cinza-600">Observações</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-tinta">{a.observacoes}</p>
          </div>
        )}
      </Painel>

      <Fotos fotos={a.fotos ?? []} />

      {/* A procedência do registro. É o que diferencia esta tela de um CRUD:
          aqui se vê não só o dado, mas COMO ele chegou. */}
      <Painel titulo="Procedência">
        <div className="grid grid-cols-2 gap-3 px-3 py-3 md:grid-cols-3">
          <LinhaDado
            rotulo="Origem"
            valor={a.criadoOffline ? 'Coletada sem conexão' : 'Coletada com conexão'}
          />
          <LinhaDado rotulo="Aparelho" valor={s?.dispositivoId} />
          <LinhaDado rotulo="Alterada no aparelho" valor={formatar.dataHora(a.alteradoEmOrigem)} />
          <LinhaDado rotulo="Recebida no servidor" valor={formatar.dataHora(a.sincronizadoEm)} />
          <LinhaDado rotulo="Tentativas de envio" valor={s?.tentativas} />
          <LinhaDado
            rotulo="Houve conflito"
            valor={s ? (s.houveConflito ? `sim · venceu o ${s.versaoVencedora}` : 'não') : null}
          />
        </div>
      </Painel>

      {a.cargas?.length > 0 && (
        <Painel titulo="Virou carga na balança">
          <Tabela
            colunas={[
              { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
              { chave: 'dataHora', titulo: 'Data', render: (c) => formatar.dataHora(c.dataHora) },
              { chave: 'estimado', titulo: 'Estimado', render: () => formatar.kg(a.quantidadeEstimadaKg) },
              { chave: 'real', titulo: 'Pesado', render: (c) => formatar.kg(c.pesoLiquidoKg) },
              {
                chave: 'erro',
                titulo: 'Diferença',
                render: (c) => {
                  if (!a.quantidadeEstimadaKg) return '—'
                  const estimado = Number(a.quantidadeEstimadaKg)
                  const real = Number(c.pesoLiquidoKg)
                  const desvio = ((real - estimado) / estimado) * 100
                  return (
                    <span className={Math.abs(desvio) > 15 ? 'text-perigo' : 'text-mate-700'}>
                      {desvio > 0 ? '+' : ''}{desvio.toFixed(1)}%
                    </span>
                  )
                },
              },
            ]}
            dados={a.cargas}
          />
        </Painel>
      )}
    </div>
  )
}

/**
 * As fotos, em tamanho que dá para julgar.
 *
 * Abrem em nova aba no clique. Não há visualizador embutido de propósito: o
 * navegador já faz zoom, rotação e download melhor do que qualquer coisa que
 * eu escrevesse aqui, e uma tela de TCC não precisa reinventar isso.
 */
function Fotos({ fotos }) {
  if (fotos.length === 0) {
    return (
      <Painel titulo="Fotos">
        <Vazio texto="Esta avaliação não tem fotos." />
      </Painel>
    )
  }

  return (
    <Painel titulo="Fotos" acao={`${fotos.length} enviada${fotos.length > 1 ? 's' : ''} do erval`}>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {fotos.map((f) => (
          <a
            key={f.id}
            href={`/uploads/${f.caminho}`}
            target="_blank"
            rel="noreferrer"
            className="block border border-borda hover:border-mate-500"
          >
            <img
              src={`/uploads/${f.caminho}`}
              alt="Foto do erval"
              className="h-[132px] w-[132px] object-cover"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Resumo da sincronização
// ---------------------------------------------------------------------------
// Era uma tela inteira, com filtro por aparelho e o log de todas as operações
// recebidas. Virou este bloco por uma razão simples: aquilo respondia a uma
// pergunta só — "chegou tudo o que foi coletado?" — e obrigava a trocar de
// página para respondê-la, justamente na tela onde a pergunta nasce.
//
// O que ficou é o que se olha: a proporção do que chegou, e o que está preso.
// O que saiu foi o log operação a operação, que interessa a quem depura a
// sincronização, não a quem confere a coleta do dia.
function ResumoDaSincronizacao({ sincronia }) {
  if (!sincronia || !sincronia.total) return null

  const porEntidade = (sincronia.porEntidade ?? []).reduce((acc, l) => {
    const chave = ROTULO_ENTIDADE[l.entidade] ?? l.entidade
    acc[chave] = acc[chave] || { enviados: 0, total: 0 }
    acc[chave].total += l.total
    if (l.situacao === 'ENVIADO') acc[chave].enviados += l.total
    return acc
  }, {})

  const presos = sincronia.pendentes + sincronia.comErro

  return (
    <Painel
      className="mb-6"
      titulo="Sincronização do aparelho"
      acao={`${sincronia.enviados} de ${sincronia.total} confirmados`}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {Object.entries(porEntidade).map(([rotulo, v]) => (
          <Barra
            key={rotulo}
            rotulo={`${rotulo} · ${v.enviados} de ${v.total}`}
            valor={`${Math.round((v.enviados / v.total) * 100)}%`}
            proporcao={(v.enviados / v.total) * 100}
            cor="bg-mate-500"
          />
        ))}

        {presos > 0 && (
          <p className="rounded-[3px] border border-[#e2c894] bg-alerta-bg px-3 py-2 text-[10.5px] leading-relaxed text-alerta">
            {sincronia.pendentes > 0 && (
              <>
                {sincronia.pendentes} {sincronia.pendentes === 1 ? 'operação aguarda' : 'operações aguardam'} uma
                dependência que ainda não chegou ao servidor — resolvem-se sozinhas no próximo envio do aparelho.
              </>
            )}
            {sincronia.pendentes > 0 && sincronia.comErro > 0 && ' '}
            {sincronia.comErro > 0 && (
              <>
                {sincronia.comErro} {sincronia.comErro === 1 ? 'foi recusada' : 'foram recusadas'} pelo servidor e
                {sincronia.comErro === 1 ? ' precisa' : ' precisam'} de uma pessoa: insistir não resolve.
              </>
            )}
          </p>
        )}

        {sincronia.conflitos > 0 && (
          <p className="text-[10px] text-cinza-400">
            {sincronia.conflitos} {sincronia.conflitos === 1 ? 'conflito resolvido' : 'conflitos resolvidos'} pela
            última edição feita no aparelho — o relógio que vale é o de quem estava no erval.
          </p>
        )}
      </div>
    </Painel>
  )
}
