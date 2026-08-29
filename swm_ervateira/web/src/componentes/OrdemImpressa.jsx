// ---------------------------------------------------------------------------
// ORDEM DE PAGAMENTO IMPRESSA · a via que fica no arquivo
// ---------------------------------------------------------------------------
// Mesma escolha do ticket de pesagem: NÃO é PDF. Gerar PDF exigiria uma
// biblioteca e um endpoint novo para produzir o que o navegador já faz com
// Ctrl+P — inclusive "imprimir para PDF", se quiserem guardar o arquivo. Uma
// dependência a menos e um formato a menos para manter.
//
// O QUE ESTE PAPEL PRECISA RESPONDER, e por isso está nele:
//
//   · para quem se paga        → nome do produtor
//   · quanto                   → o total, em destaque, e a conta que o produziu
//   · por quê                  → carga a carga, com peso, preço e desconto
//   · para onde vai o dinheiro → o destino COPIADO na emissão, não o cadastro
//
// O último item é o que diferencia esta via de uma consulta na tela. O cadastro
// do produtor muda; esta ordem foi paga para um destino específico, naquele
// dia. Se o produtor ligar em novembro dizendo que não recebeu, é este papel
// que responde para onde o dinheiro foi — e a resposta não pode depender de um
// cadastro que já mudou desde então.

import Marca from './Marca'
import { formatar } from '../lib/formatar'
import { descreverDestino } from '../lib/destino'

export default function OrdemImpressa({ ordem, aoFechar }) {
  if (!ordem) return null

  const itens = ordem.itens ?? []
  const impressoEm = new Date().toLocaleString('pt-BR')
  const pesoTotal = itens.reduce((s, i) => s + Number(i.pesoLiquidoKg || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:static print:bg-transparent print:p-0">
      <div className="ticket-impresso w-full max-w-[720px] bg-white print:max-w-none print:shadow-none">
        {/* Barra de ações — some na impressão */}
        <div className="flex items-center justify-between border-b border-borda px-4 py-2.5 print:hidden">
          <span className="text-xs font-semibold text-tinta">Ordem {ordem.numero}</span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-[3px] bg-mate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-mate-800"
            >
              Imprimir
            </button>
            <button
              onClick={aoFechar}
              className="rounded-[3px] border border-borda px-3.5 py-2 text-xs font-medium text-tinta hover:bg-cabecalho"
            >
              Fechar
            </button>
          </span>
        </div>

        <div className="px-6 py-5">
          {/* ------------------------- cabeçalho ------------------------- */}
          <div className="flex items-start justify-between border-b border-tinta pb-3">
            <div className="flex items-center gap-2.5">
              <Marca paraImpressao className="h-10 w-10 shrink-0" />
              <div>
                <p className="text-[15px] font-bold tracking-wider text-tinta">MATECH</p>
                <p className="text-[9px] text-cinza-600">gestão de matéria-prima</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-600">Ordem de pagamento</p>
              <p className="text-xl font-bold tabular text-tinta">{ordem.numero}</p>
            </div>
          </div>

          {/* -------------------------- produtor -------------------------- */}
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
            <Dado rotulo="Produtor" valor={ordem.produtor?.nome} forte />
            <Dado rotulo="CPF / CNPJ" valor={formatar.documento(ordem.produtor?.cpfCnpj)} />
            <Dado
              rotulo="Município"
              valor={ordem.produtor?.municipio ? `${ordem.produtor.municipio}${ordem.produtor.uf ? `/${ordem.produtor.uf}` : ''}` : '—'}
            />
            <Dado
              rotulo="Período"
              valor={`${formatar.data(ordem.periodoInicio)} a ${formatar.data(ordem.periodoFim)}`}
            />
          </div>

          {/* -------------------------- as cargas ------------------------- */}
          <p className="mt-5 border-b border-borda pb-1 text-[9px] font-semibold uppercase tracking-wide text-cinza-600">
            Cargas incluídas
          </p>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-borda">
                {['Ticket', 'Data', 'Peso líquido', 'Preço/kg', 'Valor'].map((h, i) => (
                  <th
                    key={h}
                    className={`py-1.5 text-[8.5px] font-semibold uppercase tracking-wide text-cinza-600 ${i > 1 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className="border-b border-borda">
                  <td className="py-1.5 text-[11px] font-semibold tabular text-tinta">{i.carga?.numeroTicket ?? '—'}</td>
                  <td className="py-1.5 text-[11px] text-cinza-600">{formatar.data(i.carga?.dataHora)}</td>
                  <td className="py-1.5 text-right text-[11px] tabular text-tinta">{formatar.kg(i.pesoLiquidoKg)}</td>
                  <td className="py-1.5 text-right text-[11px] tabular text-cinza-600">{formatar.reais(i.precoKg)}</td>
                  <td className="py-1.5 text-right text-[11px] font-semibold tabular text-tinta">{formatar.reais(i.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-2 text-[10px] text-cinza-600">
                  {itens.length} {itens.length === 1 ? 'carga' : 'cargas'}
                </td>
                <td className="pt-2 text-right text-[11px] font-semibold tabular text-tinta">{formatar.kg(pesoTotal)}</td>
                <td />
                <td className="pt-2 text-right text-base font-bold tabular text-tinta">{formatar.reais(ordem.valorTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* -------------------------- o destino ------------------------- */}
          <div className="mt-5 border border-tinta px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-600">Pagar para</p>
            <p className="mt-0.5 text-[13px] font-bold text-tinta">{descreverDestino(ordem)}</p>
            {ordem.titularSnapshot && (
              <p className="text-[10.5px] text-cinza-600">Titular: {ordem.titularSnapshot}</p>
            )}
          </div>

          {/* -------------------------- assinaturas ----------------------- */}
          <div className="mt-8 flex gap-10">
            {['Conferido por', 'Recebido por'].map((r) => (
              <div key={r} className="flex-1">
                <div className="border-t border-tinta" />
                <p className="mt-1 text-[9px] text-cinza-600">{r}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[8.5px] leading-relaxed text-cinza-600">
            Emitida em {formatar.dataHora(ordem.emitidaEm)}
            {ordem.pagaEm ? ` · quitada em ${formatar.dataHora(ordem.pagaEm)}` : ' · ainda não quitada'}.
            Impressa em {impressoEm}. A transferência é feita no banco, fora do sistema — este documento
            registra o que foi apurado e para onde o pagamento foi destinado.
          </p>
        </div>
      </div>
    </div>
  )
}

function Dado({ rotulo, valor, forte }) {
  return (
    <div>
      <p className="text-[8.5px] font-semibold uppercase tracking-wide text-cinza-600">{rotulo}</p>
      <p className={`text-[11.5px] text-tinta ${forte ? 'font-bold' : ''}`}>{valor || '—'}</p>
    </div>
  )
}
