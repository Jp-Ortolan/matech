import { Component } from 'react'

export default class LimiteDeErro extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null, pilha: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('[MATECH] a tela quebrou durante o render:', erro, info?.componentStack)
    this.setState({ pilha: info?.componentStack ?? null })
  }

  tentarDeNovo = () => this.setState({ erro: null, pilha: null })

  render() {
    const { erro, pilha } = this.state
    if (!erro) return this.props.children

    const componente = (pilha || '').trim().split('\n')[0]?.trim().replace(/^at\s+/, '')

    return (
      <div className="rounded-[3px] border border-perigo-bg bg-white">
        <header className="border-b border-borda px-4 py-2.5">
          <h2 className="text-xs font-semibold text-perigo">Esta tela não conseguiu ser desenhada</h2>
        </header>

        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-[11.5px] leading-relaxed text-cinza-600">
            O restante do sistema continua funcionando — use o menu ao lado para ir
            para outra tela. O erro abaixo é o que impediu esta de aparecer.
          </p>

          <div className="rounded-[3px] bg-perigo-bg px-3 py-2.5">
            <p className="font-mono text-[11.5px] font-semibold text-perigo">
              {erro?.name}: {erro?.message}
            </p>
            {componente && (
              <p className="mt-1 font-mono text-[10.5px] text-perigo">em {componente}</p>
            )}
          </div>

          {pilha && (
            <details className="rounded-[3px] border border-borda">
              <summary className="cursor-pointer px-3 py-2 text-[10.5px] font-medium text-cinza-600">
                Ver a pilha de componentes
              </summary>
              <pre className="overflow-x-auto border-t border-borda px-3 py-2 font-mono text-[10px] leading-relaxed text-cinza-600">
                {pilha.trim()}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2">
            <p className="flex-1 text-[10px] text-cinza-400">
              Se o erro persistir depois de tentar de novo, ele está no código da
              tela, e não em algo passageiro da conexão.
            </p>
            <button
              onClick={this.tentarDeNovo}
              className="rounded-[3px] bg-mate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-mate-800"
            >
              Tentar desenhar de novo
            </button>
          </div>
        </div>
      </div>
    )
  }
}
