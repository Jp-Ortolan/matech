import { useEffect, useState } from 'react'
import { cargas as apiCargas } from '../api/recursos'
import { Painel, LinhaDado, Situacao, Etiqueta, Carregando, Erro, Botao } from './ui'
import { formatar } from '../lib/formatar'
import { motivoResumido } from '../lib/reprovacao'

export default function FichaDaCarga({ cargaId, veDinheiro, aoImprimirTicket }) {
  const [carga, setCarga] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    apiCargas
      .buscar(cargaId)
      .then((c) => { if (ativo) setCarga(c) })
      .catch((e) => { if (ativo) setErro(e) })
      .finally(() => { if (ativo) setCarregando(false) })

    return () => { ativo = false }
  }, [cargaId])

  if (carregando) return <Painel titulo="Ficha da carga"><Carregando /></Painel>
  if (erro) return <Painel titulo="Ficha da carga"><div className="px-4 py-4"><Erro erro={erro} /></div></Painel>
  if (!carga) return null

  const analise = carga.analise
  const reprovada = analise?.aprovada === false
  const aguardandoTara = carga.situacao === 'AGUARDANDO_TARA'

  return (
    <Painel
      titulo={carga.numeroTicket}
      acao={
        aguardandoTara
          ? 'pesagem em aberto'
          : <Botao onClick={() => aoImprimirTicket(carga)}>Imprimir ticket</Botao>
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Situacao valor={carga.situacao} />
          {carga.metragemM3 != null && (
            <Etiqueta tom="verde">
              {Number(carga.metragemM3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m³
            </Etiqueta>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LinhaDado rotulo="Produtor" valor={carga.produtor?.nome} />
          <LinhaDado rotulo="Matéria-prima" valor={formatar.materiaPrima(carga.tipoMateriaPrima)} />
          <LinhaDado rotulo="Erval" valor={carga.erval?.identificacao} />
          <LinhaDado rotulo="Entrada na balança" valor={formatar.dataHora(carga.dataHora)} />
          <LinhaDado rotulo="Motorista" valor={carga.motorista?.nome} />
          <LinhaDado rotulo="Placa" valor={carga.veiculo?.placa} />
        </div>

        <div className="rounded-[3px] bg-cabecalho px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">Pesagem</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <LinhaDado rotulo="Peso bruto" valor={formatar.kg(carga.pesoBrutoKg)} />
            <LinhaDado rotulo="Tara" valor={formatar.kg(carga.taraKg)} />
            <LinhaDado rotulo="Peso líquido" valor={formatar.kg(carga.pesoLiquidoKg)} />
            <LinhaDado rotulo="Estimado em campo" valor={formatar.kg(carga.pesoEstimadoCampoKg)} />
          </div>
          {aguardandoTara && (
            <p className="mt-2 text-[10.5px] text-cinza-600">
              O caminhão ainda não voltou vazio à balança. O peso líquido fecha lá.
            </p>
          )}
        </div>

        <div className="rounded-[3px] border border-borda px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">Análise de qualidade</p>
          {analise ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <LinhaDado rotulo="Palito" valor={formatar.porcento(analise.palitoPercentual)} />
                <LinhaDado rotulo="Umidade" valor={formatar.porcento(analise.umidadePercentual)} />
                <LinhaDado rotulo="Folha" valor={formatar.porcento(analise.folhaPercentual)} />
                <LinhaDado rotulo="Lançada em" valor={formatar.dataHora(analise.dataHora)} />
              </div>
              {analise.observacoes && (
                <p className="mt-2 text-[11px] text-cinza-600">{analise.observacoes}</p>
              )}
              {reprovada && (
                <p className="mt-2 rounded-[3px] bg-perigo-bg px-3 py-2 text-[11px] font-medium text-perigo">
                  Reprovada · {motivoResumido(analise)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-cinza-400">
              {aguardandoTara
                ? 'A carga entra na fila do laboratório quando a pesagem fechar.'
                : 'Ainda na fila do laboratório.'}
            </p>
          )}
        </div>

        {veDinheiro && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <LinhaDado rotulo="Preço acordado" valor={formatar.precoKg(carga.precoBaseKg)} />
            <LinhaDado rotulo="Preço pago" valor={formatar.precoKg(analise?.precoAjustadoKg)} />
            <LinhaDado rotulo="Valor da carga" valor={formatar.reais(analise?.valorTotal)} />
          </div>
        )}

        {carga.observacoes && (
          <div>
            <p className="text-[11px] font-medium text-cinza-600">Observações da balança</p>
            <p className="mt-0.5 text-[12px] text-tinta">{carga.observacoes}</p>
          </div>
        )}
      </div>
    </Painel>
  )
}
