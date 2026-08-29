// ---------------------------------------------------------------------------
// TICKET DE PESAGEM · a via que o motorista leva
// ---------------------------------------------------------------------------
// Até aqui o número do ticket existia só na tela. Faltava o que ele significa
// na prática: um papel que sai da balança, é conferido em voz alta e vai junto
// com o caminhão. Enquanto o sistema não emitia essa via, o operador continuava
// anotando à mão — que é exatamente o retrabalho que o trabalho quer eliminar.
//
// DUAS DECISÕES QUE PARECEM DETALHE E NÃO SÃO:
//
// 1. NÃO É PDF. Gerar PDF exigiria uma biblioteca e um endpoint novo, para
//    produzir algo que o próprio navegador já faz com Ctrl+P — inclusive
//    "imprimir para PDF", se o operador quiser guardar. Uma dependência a
//    menos e um formato a menos para manter.
//
// 3. O CPF DO PRODUTOR NÃO SAI MAIS AQUI. Este papel vai para a mão do
//    motorista, que é um terceiro — é o único ponto do sistema em que dado
//    pessoal deixa a empresa em suporte físico. O ticket serve para
//    identificar a CARGA; o nome do produtor basta para isso, e o CPF só
//    estava ali por hábito de formulário.
//
// 2. O VALOR VAI MARCADO COMO PREVISTO. É a parte mais importante do papel.
//    Nesse momento a análise de laboratório ainda não aconteceu, e o palito
//    pode descontar o preço. Imprimir um número sem essa ressalva criaria uma
//    expectativa que o pagamento talvez não cumpra — e a discussão sobraria
//    para quem está na balança, com o produtor na frente.

import { formatar } from '../lib/formatar'
import { motivosDaAnalise } from '../lib/reprovacao'

export default function TicketPesagem({ carga, aoFechar }) {
  if (!carga) return null


  const emitidoEm = new Date().toLocaleString('pt-BR')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:static print:bg-transparent print:p-0">
      <div className="ticket-impresso w-full max-w-[420px] bg-white print:max-w-none print:shadow-none">
        {/* Barra de ações — some na impressão */}
        <div className="flex items-center justify-between border-b border-borda px-4 py-2.5 print:hidden">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
            Via do motorista
          </span>
          <span className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="text-[11px] font-semibold text-mate-700 hover:underline"
            >
              Imprimir
            </button>
            <button
              onClick={aoFechar}
              className="text-[11px] font-semibold text-cinza-400 hover:text-tinta"
            >
              Fechar
            </button>
          </span>
        </div>

        <div className="px-6 py-5 text-tinta">
          <div className="flex items-start justify-between border-b border-tinta pb-3">
            <div>
              <p className="text-[15px] font-bold tracking-[0.18em]">MATECH</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-cinza-600">
                Recebimento de matéria-prima
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
                Ticket
              </p>
              <p className="font-mono text-[17px] font-bold">{carga.numeroTicket}</p>
            </div>
          </div>

          <Linha rotulo="Data e hora" valor={formatar.dataHora(carga.dataHora)} />
          <Linha rotulo="Produtor" valor={carga.produtor?.nome} />
          <Linha rotulo="Motorista" valor={carga.motorista?.nome} />
          <Linha rotulo="Veículo" valor={carga.veiculo?.placa} />
          <Linha rotulo="Matéria-prima" valor={formatar.materiaPrima(carga.tipoMateriaPrima)} />

          <div className="mt-3 border-t border-borda pt-3">
            <Linha rotulo="Peso bruto" valor={formatar.kg(carga.pesoBrutoKg)} />
            <Linha rotulo="Tara" valor={formatar.kg(carga.taraKg)} />
            <Linha rotulo="Peso líquido" valor={formatar.kg(carga.pesoLiquidoKg)} destaque />
          </div>

          {/* A REIMPRESSÃO de uma carga reprovada leva o motivo junto.
              O ticket sai duas vezes: na balança, quando ainda não há análise,
              e depois, quando o produtor volta perguntando. É na segunda que
              este bloco existe — e é a diferença entre entregar um papel que
              explica e mandar a pessoa procurar alguém que saiba. */}
          {carga.analise?.aprovada === false && (
            <div className="mt-3 border border-tinta px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide">
                Carga reprovada na análise
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {motivosDaAnalise(carga.analise).map((frase, i) => (
                  <li key={i} className="text-[10px] leading-relaxed">{frase}</li>
                ))}
              </ul>
              <p className="mt-1 text-[9px] text-cinza-600">
                Análise de {formatar.dataHora(carga.analise.dataHora)}. Carga reprovada não gera pagamento.
              </p>
            </div>
          )}

          <p className="mt-3 border border-borda px-3 py-2 text-[9.5px] leading-relaxed text-cinza-600">
            <strong className="text-tinta">Comprovante de pesagem.</strong> O valor a pagar
            é definido na ordem de pagamento, depois da análise de qualidade — o percentual
            de palito medido no laboratório reduz o preço por quilo.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <Assinatura papel="Operador de balança" />
            <Assinatura papel="Motorista" />
          </div>

          <p className="mt-5 border-t border-borda pt-2 text-[8.5px] text-cinza-400">
            Emitido em {emitidoEm} · documento gerado pelo sistema, sem valor fiscal
          </p>
        </div>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor, destaque = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="text-[10px] uppercase tracking-wide text-cinza-600">{rotulo}</span>
      <span
        className={`tabular text-right ${
          destaque ? 'text-[13px] font-bold' : 'text-[11.5px] font-medium'
        }`}
      >
        {valor ?? '—'}
      </span>
    </div>
  )
}

function Assinatura({ papel }) {
  return (
    <div>
      <div className="h-8 border-b border-tinta" />
      <p className="mt-1 text-center text-[9px] uppercase tracking-wide text-cinza-600">{papel}</p>
    </div>
  )
}
