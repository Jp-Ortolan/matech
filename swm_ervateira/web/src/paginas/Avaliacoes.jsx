import { useEffect, useState, useCallback } from 'react'
import { qualidade as apiQualidade } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { Painel, Tabela, Campo, Botao, Carregando, Erro } from '../componentes/ui'
import { formatar, contagem } from '../lib/formatar'

export default function Avaliacoes() {
  const { podeFazer } = useAutenticacao()

  const [fila, setFila] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscarFila = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const r = await apiQualidade.fila()
      setFila(r.cargas)
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

function FormularioAnalise({ carga, podeLancar, aoConcluir }) {
  const [form, setForm] = useState({
    palitoPercentual: '', umidadePercentual: '', folhaPercentual: '',
    observacoes: '', motivoReprovacao: '',
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setForm({
      palitoPercentual: '', umidadePercentual: '', folhaPercentual: '',
      observacoes: '', motivoReprovacao: '',
    })
    setErro(null)
  }, [carga.id])

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const semJustificativa = !form.motivoReprovacao.trim()

  async function enviar(e, aprovada) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await apiQualidade.registrarAnalise(carga.id, {
        palitoPercentual: Number(form.palitoPercentual),
        umidadePercentual: form.umidadePercentual === '' ? null : Number(form.umidadePercentual),
        folhaPercentual: form.folhaPercentual === '' ? null : Number(form.folhaPercentual),
        observacoes: form.observacoes || null,
        motivoReprovacao: form.motivoReprovacao.trim() || null,
        aprovada,
      })
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[3px] bg-cabecalho px-3 py-2.5">
          {[
            ['Produtor', carga.produtor?.nome],
            ['Erval', carga.erval?.identificacao || '—'],
            ['Peso líquido', formatar.kg(carga.pesoLiquidoKg)],
            ['Chegada', formatar.dataHora(carga.dataHora)],
          ].map(([r, v]) => (
            <div key={r}>
              <p className="text-[11px] font-semibold text-cinza-600">{r}</p>
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

        {podeLancar && (
          <Campo
            rotulo="Motivo da reprovação"
            placeholder="ex.: amostra com cheiro de mofo"
            value={form.motivoReprovacao}
            onChange={(e) => alterar('motivoReprovacao', e.target.value)}
          />
        )}

        <div className="rounded-[3px] border border-borda">
          {[
            ['Peso líquido', formatar.kg(carga.pesoLiquidoKg)],
            ['Palito medido', form.palitoPercentual === '' ? '—' : `${form.palitoPercentual}%`],
            ['Umidade medida', form.umidadePercentual === '' ? '—' : `${form.umidadePercentual}%`],
            ['Folha medida', form.folhaPercentual === '' ? '—' : `${form.folhaPercentual}%`],
          ].map(([r, v], i) => (
            <div key={r} className={`flex items-center gap-2 px-3 py-2 ${i < 3 ? 'border-b border-borda' : ''}`}>
              <span className="flex-1 text-[11px] text-cinza-600">{r}</span>
              <span className="text-[11.5px] font-semibold tabular text-tinta">{v}</span>
            </div>
          ))}
        </div>

        <p className="text-[10.5px] text-cinza-400">
          O valor a pagar é definido na emissão da ordem, onde o preço por quilo é
          acordado com o produtor.
        </p>

        {podeLancar ? (
          <div className="flex gap-2">
            <Botao
              variante="perigo" type="button" className="flex-1 justify-center"
              disabled={enviando || !form.palitoPercentual || semJustificativa}
              title={semJustificativa ? 'Escreva o motivo da reprovação.' : undefined}
              onClick={(e) => enviar(e, false)}
            >
              Reprovar carga
            </Botao>
            <Botao
              variante="primario" type="submit" className="flex-1 justify-center"
              disabled={enviando || !form.palitoPercentual}
            >
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
