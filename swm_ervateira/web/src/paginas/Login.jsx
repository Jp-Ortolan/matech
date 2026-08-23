// ---------------------------------------------------------------------------
// PÁGINA · entrar no sistema
// ---------------------------------------------------------------------------
// Envia usuário e senha para POST /api/auth/login. Se der certo, o token fica
// guardado e o React Router leva ao painel. Se der errado, mostra a mensagem
// que veio do back-end — a mesma para usuário inexistente e senha errada,
// para não revelar quais usuários existem.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutenticacao } from '../contexto/Autenticacao'
import { Campo, Botao, Erro } from '../componentes/ui'

export default function Login() {
  const { entrar } = useAutenticacao()
  const navegar = useNavigate()

  const [usuario, setUsuario] = useState('rogerio.anselmo')
  const [senha, setSenha] = useState('matech123')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e) {
    e.preventDefault()          // impede o navegador de recarregar a página
    setErro(null)
    setEnviando(true)
    try {
      await entrar(usuario, senha)
      navegar('/')
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* lado esquerdo · identidade */}
      <aside className="hidden w-[46%] max-w-[620px] shrink-0 flex-col justify-center gap-5 bg-mate-900 px-10 lg:flex xl:px-16">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-mate-500 text-xl font-bold text-white">
            M
          </span>
          <span>
            <span className="block text-3xl font-bold tracking-widest text-white">MATECH</span>
            <span className="block text-[11px] font-medium tracking-wide text-white/50">
              gestão de matéria-prima
            </span>
          </span>
        </div>

        <p className="max-w-[470px] text-[15px] leading-relaxed text-white/70">
          Sistema de controle de recebimento, avaliação em campo e pagamento de
          matéria-prima em indústrias ervateiras.
        </p>

        <ul className="flex flex-col gap-3">
          {[
            'Pesagem, ticket e rastreabilidade da carga',
            'Avaliação em campo mesmo sem internet',
            'Cálculo de pagamento com desconto por qualidade',
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 text-[13px] text-white/70">
              <span className="h-[7px] w-[7px] rounded-[1px] bg-mate-500" />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* lado direito · formulário */}
      <div className="flex flex-1 items-center justify-center bg-white px-6">
        <form onSubmit={aoEnviar} className="flex w-full max-w-[360px] flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tinta">Acessar o sistema</h1>
            <p className="mt-1 text-xs text-cinza-600">
              Use o usuário fornecido pelo setor administrativo.
            </p>
          </div>

          <Erro erro={erro} />

          <Campo
            rotulo="Usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            required
          />
          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <Botao variante="primario" type="submit" disabled={enviando} className="justify-center py-3">
            {enviando ? 'Entrando...' : 'Entrar'}
          </Botao>

          <p className="text-[10.5px] text-cinza-400">
            Usuários de teste: rogerio.anselmo (balança), cristiane.modesto (qualidade),
            marcos.ferrari (campo), solange.petry (administrativo). Senha: matech123
          </p>
        </form>
      </div>
    </div>
  )
}
