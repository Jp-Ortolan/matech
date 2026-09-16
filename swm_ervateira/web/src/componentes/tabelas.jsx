import { Situacao } from './ui'
import { formatar } from '../lib/formatar'
import { motivoResumido } from '../lib/reprovacao'

export function colunasDeCargas({ veDinheiro, compacta = false } = {}) {
  return [
    {
      chave: 'ticket', titulo: 'Ticket', forte: true,
      render: (c) => (
        <span className="block leading-tight">
          <span className="block tabular">{c.numeroTicket}</span>
          {!compacta && (
            <span className="block text-[10px] font-normal text-cinza-400 tabular">
              {formatar.dataHora(c.dataHora)}
            </span>
          )}
        </span>
      ),
    },
    {
      chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 240,
      render: (c) => (
        <span className="block leading-tight">
          <span className="block truncate">{c.produtor?.nome ?? '—'}</span>
          {!compacta && (
            <span className="block truncate text-[10px] font-normal text-cinza-400">
              {formatar.materiaPrima(c.tipoMateriaPrima)}
              {c.analise?.aprovada === false && (
                <span className="text-perigo" title={motivoResumido(c.analise)}>
                  {' · '}{motivoResumido(c.analise)}
                </span>
              )}
            </span>
          )}
        </span>
      ),
    },
    {
      chave: 'peso', titulo: 'Peso líquido', alinhar: 'direita', forte: true,
      render: (c) => formatar.kg(c.pesoLiquidoKg),
    },
    ...(veDinheiro
      ? [{
          chave: 'valor', titulo: 'Valor', alinhar: 'direita', forte: true,
          render: (c) => formatar.reais(c.analise?.valorTotal),
        }]
      : []),
    {
      chave: 'situacao', titulo: 'Situação', fixar: 'direita',
      render: (c) => <Situacao valor={c.situacao} />,
    },
  ]
}
