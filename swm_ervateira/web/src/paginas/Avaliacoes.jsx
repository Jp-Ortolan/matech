// ---------------------------------------------------------------------------
// PÁGINA · avaliações de qualidade (laboratório)
// ---------------------------------------------------------------------------
// Duas metades: à esquerda a fila de amostras que chegaram e ainda não foram
// analisadas; à direita o formulário da amostra selecionada.
//
// A decisão de interface que importa aqui: a memória de cálculo fica VISÍVEL,
// linha a linha, e recalcula enquanto o analista digita. O motivo é concreto —
// quando o produtor questionar o desconto, o analista precisa conseguir mostrar
// de onde saiu o número, e não apenas o resultado final.

import { useEffect, useState, useCallback } from 'react'
import { qualidade as apiQualidade } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { Painel, Tabela, Campo, Botao, Carregando, Erro } from '../componentes/ui'
import { calcularPagamento, LIMITE_PALITO_PADRAO } from '../lib/calculo'
import { formatar, contagem } from '../lib/formatar'

export default function Avaliacoes() {
  const { podeFazer } = useAutenticacao()

  const [fila, setFila] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscarFila = useCallback(async () => {
    setCarregando(true)
    // Limpar o erro ANTES de tentar de novo. Sem isto, uma falha passageira da
    // API deixava o banner vermelho preso na tela mesmo depois que a fila
    // voltava a carregar — a tela dizia que estava quebrada enquanto funcionava.
    setErro(null)
    try {
      const r = await apiQualidade.fila()
      setFila(r.cargas)
      // Mantém a seleção se a carga ainda estiver na fila; senão pega a primeira.
      setSelecionada((atual) => {
        const aindaExiste = r.cargas.find((c) => c.id === atual?.id)
        return aindaExiste || r.cargas[0] || null
      })
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscarFila() }, [buscarFila])

  return (
    <>
      <CabecalhoPagina
        titulo="Avaliações de qualidade"
        subtitulo={fila.length ? contagem(fila.length, 'amostra na fila', 'amostras na fila') : null}
      />

      <Erro erro={erro} />

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_420px]">
        <Painel titulo="Fila de amostras" acao={`${fila.length} pendentes`}>
          {carregando ? (
            <Carregando />
          ) : (
            <Tabela
              colunas={[
                { chave: 'numeroTicket', titulo: 'Ticket', forte: true },
                { chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 180, render: (c) => c.produtor?.nome },
                { chave: 'tipo', titulo: 'Matéria-prima', oculta: 'xl', render: (c) => formatar.materiaPrima(c.tipoMateriaPrima) },
                { chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true, render: (c) => formatar.kg(c.pesoLiquidoKg) },
                { chave: 'chegada', titulo: 'Chegada', render: (c) => formatar.dataHora(c.dataHora) },
                {
                  chave: 'acao', titulo: '', render: (c) => (
                    <button
                      onClick={() => setSelecionada(c)}
                      className={`text-[11px] font-semibold ${
                        selecionada?.id === c.id ? 'text-mate-700' : 'text-cinza-400 hover:text-mate-700'
                      }`}
                    >
                      {selecionada?.id === c.id ? 'aberta' : 'abrir'}
                    </button>
                  ),
                },
              ]}
              dados={fila}
              vazio="Nenhuma amostra aguardando. Toda carga recebida já foi analisada."
            />
          )}
        </Painel>

        {selecionada ? (
          <FormularioAnalise
            carga={selecionada}
            podeLancar={podeFazer('ANALISTA_QUALIDADE')}
            aoConcluir={buscarFila}
          />
        ) : (
          <Painel titulo="Análise">
            <p className="px-4 py-10 text-center text-xs text-cinza-400">
              Selecione uma amostra na fila.
            </p>
          </Painel>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Formulário da análise
// ---------------------------------------------------------------------------

function FormularioAnalise({ carga, podeLancar, aoConcluir }) {
  const [form, setForm] = useState({ palitoPercentual: '', umidadePercentual: '', folhaPercentual: '', observacoes: '' })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  // Ao trocar de amostra, limpa o formulário.
  useEffect(() => {
    setForm({ palitoPercentual: '', umidadePercentual: '', folhaPercentual: '', observacoes: '' })
    setErro(null)
    setResultado(null)
  }, [carga.id])

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // Pré-visualização: recalcula a cada tecla. O servidor refaz a conta ao gravar.
  const previa = calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
    palitoPercentual: form.palitoPercentual,
  })

  const acimaDoLimite = form.palitoPercentual !== '' && Number(form.palitoPercentual) > LIMITE_PALITO_PADRAO

  async function enviar(e, aprovada) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const r = await apiQualidade.registrarAnalise(carga.id, {
        palitoPercentual: Number(form.palitoPercentual),
        umidadePercentual: form.umidadePercentual === '' ? null : Number(form.umidadePercentual),
        folhaPercentual: form.folhaPercentual === '' ? null : Number(form.folhaPercentual),
        observacoes: form.observacoes || null,
        aprovada,
      })
      // A partir daqui exibimos o cálculo QUE O SERVIDOR DEVOLVEU, não o nosso.
      setResultado(r.calculo)
      aoConcluir()
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel
      titulo={`Análise · ${carga.numeroTicket}`}
      acao={formatar.materiaPrima(carga.tipoMateriaPrima)}
    >
      <form onSubmit={(e) => enviar(e, true)} className="flex flex-col gap-3 px-4 py-4">
        {/* identificação da amostra */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[3px] bg-cabecalho px-3 py-2.5">
          {[
            ['Produtor', carga.produtor?.nome],
            ['Erval', carga.erval?.identificacao || '—'],
            ['Peso líquido', formatar.kg(carga.pesoLiquidoKg)],
            ['Chegada', formatar.dataHora(carga.dataHora)],
          ].map(([r, v]) => (
            <div key={r}>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">{r}</p>
              <p className="text-[11.5px] font-semibold text-tinta">{v}</p>
            </div>
          ))}
        </div>

        {carga.avaliacao && (
          <p className="rounded-[3px] bg-mate-100 px-3 py-2 text-[10.5px] text-mate-700">
            Avaliação de campo: classificação {carga.avaliacao.classificacao || '—'} ·
            umidade estimada {carga.avaliacao.umidadeEstimada ?? '—'}% ·
            queima {carga.avaliacao.ervaQueimada?.toLowerCase().replace('_', ' ')}
          </p>
        )}

        <Erro erro={erro} />

        <div className="grid grid-cols-3 gap-3">
          <Campo
            rotulo="Palito (%)" type="number" step="0.1" min="0" max="100" required autoFocus
            value={form.palitoPercentual} onChange={(e) => alterar('palitoPercentual', e.target.value)}
            disabled={!podeLancar}
          />
          <Campo
            rotulo="Umidade (%)" type="number" step="0.1" min="0" max="100"
            value={form.umidadePercentual} onChange={(e) => alterar('umidadePercentual', e.target.value)}
            disabled={!podeLancar}
          />
          <Campo
            rotulo="Folha (%)" type="number" step="0.1" min="0" max="100"
            value={form.folhaPercentual} onChange={(e) => alterar('folhaPercentual', e.target.value)}
            disabled={!podeLancar}
          />
        </div>

        <Campo
          rotulo="Observações da análise"
          value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)}
          disabled={!podeLancar}
        />

        {acimaDoLimite && (
          <p className="rounded-[3px] border border-[#e2c894] bg-alerta-bg px-3 py-2 text-[11px] font-medium text-alerta">
            Palito {previa.excedentePalito} p.p. acima do limite de {LIMITE_PALITO_PADRAO}%.
            Desconto de {previa.descontoPercentual}% aplicado ao preço.
          </p>
        )}

        {/* A memória de cálculo do laboratório.
            O que ela mostra agora é o DESCONTO, não o valor: o preço entra na
            emissão da ordem, e é lá que este percentual vira dinheiro. O
            analista precisa saber quanto descontou e por quê — quanto isso
            vale é decisão do administrativo. */}
        <div className="rounded-[3px] border border-borda">
          {[
            ['Peso líquido', formatar.kg(carga.pesoLiquidoKg)],
            ['Palito medido', form.palitoPercentual === '' ? '—' : `${form.palitoPercentual}%`],
            ['Limite acordado', `${LIMITE_PALITO_PADRAO},0%`],
            ['Excedente', `${(resultado ?? previa).excedentePalito} p.p.`],
          ].map(([r, v], i) => (
            <div key={r} className={`flex items-center gap-2 px-3 py-2 ${i < 3 ? 'border-b border-borda' : ''}`}>
              <span className="flex-1 text-[11px] text-cinza-600">{r}</span>
              <span className="text-[11.5px] font-semibold tabular text-tinta">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 bg-mate-100 px-3 py-3">
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-wide text-mate-700">
              Desconto por qualidade
            </span>
            <span className="text-lg font-bold tabular text-mate-700">
              −{(resultado ?? previa).descontoPercentual}%
            </span>
          </div>
        </div>

        <p className="text-[10.5px] text-cinza-400">
          O valor a pagar é definido na emissão da ordem, onde o preço por quilo é
          informado. Este desconto será aplicado sobre ele.
        </p>

        {podeLancar ? (
          <div className="flex gap-2">
            <Botao variante="perigo" type="button" disabled={enviando || !form.palitoPercentual}
                   onClick={(e) => enviar(e, false)} className="flex-1 justify-center">
              Reprovar carga
            </Botao>
            <Botao variante="primario" type="submit" disabled={enviando || !form.palitoPercentual}
                   className="flex-1 justify-center">
              {enviando ? 'Gravando...' : 'Confirmar análise'}
            </Botao>
          </div>
        ) : (
          <p className="rounded-[3px] bg-cabecalho px-3 py-2 text-[11px] text-cinza-600">
            Somente o Analista de Qualidade lança análises. Modo leitura.
          </p>
        )}
      </form>
    </Painel>
  )
}
