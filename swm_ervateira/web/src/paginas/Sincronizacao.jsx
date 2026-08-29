// ---------------------------------------------------------------------------
// PÁGINA · sincronização
// ---------------------------------------------------------------------------
// A tela que torna a contribuição do trabalho mensurável.
//
// Ela consome duas rotas que existiam no servidor desde o começo e nunca
// tinham sido usadas: /api/sincronizacao/resumo e /registros. Enquanto
// ninguém as consumia, a taxa do Quadro 7 era um número que só existia dentro
// do banco — e um indicador que ninguém enxerga não é indicador, é intenção.
//
// O QUE ELA RESPONDE, na ordem em que as perguntas aparecem:
//
//   1. quanto do que foi coletado em campo já está a salvo aqui?
//   2. tem alguma coisa presa, e por quê?
//   3. houve conflito entre o aparelho e o servidor? quem venceu?
//
// A terceira é a que interessa à banca. As duas primeiras é que interessam a
// quem usa o sistema todo dia — e essa diferença de público é o motivo de a
// taxa ficar no topo, grande, e o log de operações ficar embaixo.

import { useCallback, useEffect, useState } from 'react'
import { sincronizacao } from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, Tabela, Indicador, Selecao, Botao, Etiqueta, Barra,
  Carregando, Erro
} from '../componentes/ui'
import { formatar, contagem } from '../lib/formatar'

const SITUACOES = {
  ENVIADO: { rotulo: 'no servidor', tom: 'verde' },
  PENDENTE: { rotulo: 'aguardando', tom: 'alerta' },
  ERRO: { rotulo: 'recusado', tom: 'perigo' },
}

const ROTULO_ENTIDADE = {
  Produtor: 'Produtor',
  Erval: 'Área de colheita',
  Avaliacao: 'Avaliação',
  FotoErval: 'Foto',
}

export default function SincronizacaoPagina() {
  const [dispositivoId, setDispositivoId] = useState('')
  const [situacao, setSituacao] = useState('')
  const [resumo, setResumo] = useState(null)
  const [registros, setRegistros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // As duas de uma vez: os números do topo e o log de baixo descrevem o
      // mesmo instante, e buscá-las em momentos diferentes deixaria a soma do
      // log discordando do total do placar.
      const [r, l] = await Promise.all([
        sincronizacao.resumo(dispositivoId || undefined),
        sincronizacao.registros({ dispositivoId: dispositivoId || undefined, situacao: situacao || undefined, limite: 200 }),
      ])
      setResumo(r)
      setRegistros(l.registros)
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [dispositivoId, situacao])

  useEffect(() => { buscar() }, [buscar])

  // Os aparelhos que já enviaram alguma coisa. Sai do próprio log, e não de um
  // cadastro de dispositivos — que não existe e não precisa existir: um
  // aparelho passa a existir para o sistema no instante em que envia algo.
  const aparelhos = [...new Set(registros.map((r) => r.dispositivoId))].sort()

  if (erro) return <Erro erro={erro} />

  return (
    <>
      <CabecalhoPagina titulo="Sincronização">
        <Botao onClick={buscar}>Atualizar</Botao>
      </CabecalhoPagina>

      <Filtros>
        <Selecao
          rotulo="Aparelho"
          className="flex-[2]"
          value={dispositivoId}
          onChange={(e) => setDispositivoId(e.target.value)}
        >
          <option value="">Todos os aparelhos</option>
          {aparelhos.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Selecao>
        <Selecao rotulo="Situação" className="flex-1" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          <option value="">Todas</option>
          <option value="ENVIADO">Confirmadas</option>
          <option value="PENDENTE">Aguardando</option>
          <option value="ERRO">Recusadas</option>
        </Selecao>
        <span className="flex-1" />
      </Filtros>

      <div className="mb-3 flex flex-wrap gap-2">
        <Indicador
          rotulo="Taxa de sincronização"
          valor={resumo?.taxaSincronizacao != null ? `${formatar.numero(resumo.taxaSincronizacao, 1)}%` : '—'}
          apoio="confirmados ÷ total coletado"
          cor="text-mate-700"
        />
        <Indicador rotulo="Confirmados" valor={resumo?.enviados ?? '—'} apoio="gravados no servidor" />
        <Indicador
          rotulo="Aguardando"
          valor={resumo?.pendentes ?? '—'}
          apoio="dependência ainda não chegou"
        />
        <Indicador
          rotulo="Recusados"
          valor={resumo?.comErro ?? '—'}
          apoio="precisam de uma pessoa"
          cor={resumo?.comErro > 0 ? 'text-perigo' : 'text-tinta'}
        />
      </div>

      {carregando ? (
        <Carregando />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <PorEntidade porEntidade={resumo?.porEntidade ?? []} />
            <Conflitos conflitos={resumo?.conflitos ?? 0} total={resumo?.total ?? 0} />
          </div>

          <Painel titulo="Operações recebidas" acao={`${registros.length} na lista`}>
            <Tabela
              colunas={[
                { chave: 'recebidoEm', titulo: 'Recebida', render: (r) => formatar.dataHora(r.recebidoEm) },
                {
                  chave: 'entidade',
                  titulo: 'O quê',
                  forte: true,
                  render: (r) => ROTULO_ENTIDADE[r.entidade] || r.entidade,
                },
                { chave: 'dispositivoId', titulo: 'Aparelho', truncar: 140, oculta: 'xl', render: (r) => r.dispositivoId },
                {
                  chave: 'situacao',
                  titulo: 'Situação',
                  render: (r) => {
                    const s = SITUACOES[r.situacao] ?? { rotulo: r.situacao, tom: 'neutro' }
                    return (
                      <span className="flex flex-wrap gap-1">
                        <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                        {r.tentativas > 1 && <Etiqueta>{r.tentativas} tentativas</Etiqueta>}
                        {r.houveConflito && <Etiqueta tom="alerta">conflito · {r.versaoVencedora}</Etiqueta>}
                      </span>
                    )
                  },
                },
                {
                  chave: 'atraso',
                  titulo: 'Atraso',
                  alinhar: 'direita',
                  // Quanto tempo o dado passou APENAS no aparelho. É a medida
                  // concreta do problema que o trabalho resolve: em papel,
                  // esse intervalo era o tempo até alguém redigitar a ficha.
                  render: (r) => {
                    if (!r.criadoEmOrigem || !r.recebidoEm) return '—'
                    const minutos = Math.round(
                      (new Date(r.recebidoEm) - new Date(r.criadoEmOrigem)) / 60000
                    )
                    if (minutos < 1) return 'imediato'
                    if (minutos < 60) return `${minutos} min`
                    return `${(minutos / 60).toFixed(1)} h`
                  },
                },
              ]}
              dados={registros}
              vazio="Nenhuma operação recebida ainda."
            />
            {registros.some((r) => r.erroMensagem) && (
              <div className="border-t border-borda px-4 py-3">
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
                  Mensagens do servidor
                </p>
                <ul className="space-y-1">
                  {registros
                    .filter((r) => r.erroMensagem)
                    .slice(0, 8)
                    .map((r) => (
                      <li key={r.id} className="text-[10.5px] leading-relaxed text-cinza-600">
                        <span className="font-semibold text-tinta">
                          {ROTULO_ENTIDADE[r.entidade] || r.entidade}
                        </span>{' '}
                        — {r.erroMensagem}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Painel>
        </div>
      )}
    </>
  )
}

/**
 * Quanto de cada tipo de registro chegou.
 *
 * A leitura útil é a proporção entre entidades: se há muito mais fotos
 * aguardando do que avaliações, o gargalo é banda, não regra de negócio.
 */
function PorEntidade({ porEntidade }) {
  const agrupado = {}
  for (const linha of porEntidade) {
    agrupado[linha.entidade] ??= { total: 0, enviado: 0 }
    agrupado[linha.entidade].total += linha.total
    if (linha.situacao === 'ENVIADO') agrupado[linha.entidade].enviado += linha.total
  }

  const entidades = Object.entries(agrupado)

  return (
    <Painel titulo="Por tipo de registro">
      {entidades.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-cinza-400">Nada recebido ainda.</p>
      ) : (
        <div className="space-y-3 px-3 py-3">
          {entidades.map(([entidade, n]) => (
            <Barra
              key={entidade}
              rotulo={`${ROTULO_ENTIDADE[entidade] || entidade} · ${n.enviado} de ${n.total}`}
              valor={`${Math.round((n.enviado / n.total) * 100)}%`}
              proporcao={(n.enviado / n.total) * 100}
              cor={n.enviado === n.total ? 'bg-mate-500' : 'bg-mate-300'}
            />
          ))}
        </div>
      )}
    </Painel>
  )
}

function Conflitos({ conflitos, total }) {
  return (
    <Painel titulo="Conflitos" acao="vence a última edição no aparelho">
      <div className="flex items-baseline gap-2 px-3 py-3">
        <p className={`text-2xl font-bold tabular ${conflitos > 0 ? 'text-alerta' : 'text-tinta'}`}>
          {conflitos}
        </p>
        <p className="text-[10px] text-cinza-400">
          de {contagem(total, 'operação recebida', 'operações recebidas')}
        </p>
      </div>
    </Painel>
  )
}
