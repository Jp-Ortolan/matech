import { useState } from 'react'
import { auth } from '../api/recursos'
import { useAutenticacao, NOME_PERFIL } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { Painel, Campo, Botao, LinhaDado, Erro, Sucesso } from '../componentes/ui'

export default function Configuracoes() {
  const { usuario, sair } = useAutenticacao()

  return (
    <>
      <CabecalhoPagina titulo="Configurações" />

      <div className="mx-auto grid max-w-[760px] grid-cols-1 items-start gap-3 md:grid-cols-2">
        <MinhaConta usuario={usuario} />
        <div className="flex flex-col gap-3">
          <Seguranca />
          <Sessao aoSair={sair} />
        </div>
      </div>
    </>
  )
}

function MinhaConta({ usuario }) {
  const iniciais = (usuario?.nome || '')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  return (
    <Painel titulo="Minha conta">
      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-mate-100 text-sm font-bold text-mate-700">
            {iniciais}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-tinta">{usuario?.nome}</p>
            <p className="truncate text-[10.5px] text-cinza-600">
              {NOME_PERFIL[usuario?.perfil] || usuario?.perfil}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-borda pt-3">
          <LinhaDado rotulo="Usuário" valor={usuario?.usuario} />
          <LinhaDado rotulo="Perfil" valor={NOME_PERFIL[usuario?.perfil] || usuario?.perfil} />
        </div>
      </div>
    </Painel>
  )
}

function Seguranca() {
  const [form, setForm] = useState({ senhaAtual: '', senhaNova: '', confirmacao: '' })
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const naoConfere = form.confirmacao !== '' && form.senhaNova !== form.confirmacao
  const podeEnviar =
    form.senhaAtual && form.senhaNova.length >= 6 && form.senhaNova === form.confirmacao

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setAviso('')
  }

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setAviso('')
    setEnviando(true)
    try {
      await auth.trocarSenha(form.senhaAtual, form.senhaNova)
      setForm({ senhaAtual: '', senhaNova: '', confirmacao: '' })
      setAviso('Senha alterada.')
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Segurança">
      <form onSubmit={enviar} className="flex flex-col gap-3 px-3 py-3">
        <Erro erro={erro} />
        <Sucesso texto={aviso} />

        <Campo
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          value={form.senhaAtual}
          onChange={(e) => alterar('senhaAtual', e.target.value)}
        />
        <Campo
          rotulo="Nova senha"
          type="password"
          autoComplete="new-password"
          value={form.senhaNova}
          onChange={(e) => alterar('senhaNova', e.target.value)}
        />
        <Campo
          rotulo="Repetir a nova senha"
          type="password"
          autoComplete="new-password"
          value={form.confirmacao}
          onChange={(e) => alterar('confirmacao', e.target.value)}
        />

        {naoConfere && (
          <p className="text-[10.5px] font-medium text-perigo">As duas senhas não conferem.</p>
        )}
        {form.senhaNova !== '' && form.senhaNova.length < 6 && (
          <p className="text-[10.5px] text-cinza-400">Ao menos 6 caracteres.</p>
        )}

        <Botao variante="primario" type="submit" disabled={!podeEnviar || enviando} className="justify-center">
          {enviando ? 'Alterando...' : 'Alterar senha'}
        </Botao>
      </form>
    </Painel>
  )
}

function Sessao({ aoSair }) {
  return (
    <Painel titulo="Sessão">
      <div className="px-3 py-3">
        <Botao variante="perigo" onClick={aoSair} className="w-full justify-center">
          Encerrar sessão
        </Botao>
      </div>
    </Painel>
  )
}
