// ---------------------------------------------------------------------------
// PÁGINA · configurações
// ---------------------------------------------------------------------------
// A conta de quem está logado. Três coisas: quem sou, trocar minha senha,
// sair. Nada mais.
//
// O que saiu daqui, e por quê: a matriz de quinze operações por perfil, o
// estado da API e do banco, o prazo do token e os parâmetros do cálculo.
// Nenhum deles é configuração de conta — eram documentação do sistema numa
// tela onde o operador de balança entra para trocar a própria senha. A
// administração de contas, que era o único conteúdo dali com uso real, virou
// tela própria em /usuarios, do administrador.

import { useState } from 'react'
import { auth } from '../api/recursos'
import { useAutenticacao, NOME_PERFIL } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import { Painel, Campo, Botao, LinhaDado, Erro, Sucesso } from '../componentes/ui'
import { GLOSSARIO } from '../lib/glossario'

export default function Configuracoes() {
  const { usuario, sair } = useAutenticacao()

  return (
    <>
      <CabecalhoPagina titulo="Configurações" />

      <div className="grid max-w-[760px] grid-cols-1 items-start gap-3 md:grid-cols-2">
        <MinhaConta usuario={usuario} />
        <div className="flex flex-col gap-3">
          <Seguranca />
          <Sessao aoSair={sair} />
        </div>
      </div>

      <div className="mt-3 max-w-[760px]">
        <Glossario />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Glossário
// ---------------------------------------------------------------------------
// Fica em Configurações, e não numa tela própria no menu, porque não é uma
// fase do trabalho: é consulta, e consulta de quem está começando. Quem opera
// a balança há dez anos sabe o que é tara; quem chegou ontem precisa de um
// lugar onde perguntar sem perguntar para ninguém.

function Glossario() {
  return (
    <Painel titulo="O que cada termo significa">
      <div className="flex flex-col gap-4 px-4 py-4">
        {GLOSSARIO.map((g) => (
          <div key={g.grupo}>
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
              {g.grupo}
            </p>
            <dl className="flex flex-col gap-2">
              {g.termos.map((t) => (
                <div key={t.termo} className="grid grid-cols-1 gap-x-3 sm:grid-cols-[160px_1fr]">
                  <dt className="text-[11.5px] font-semibold text-tinta">{t.termo}</dt>
                  <dd className="text-[11px] leading-relaxed text-cinza-600">{t.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Painel>
  )
}

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------
// A senha atual é pedida de propósito. O risco concreto é alguém sentar num
// computador que ficou destravado e trocar a senha de quem esqueceu de sair —
// pedir a atual fecha essa porta. O servidor confere de novo, e é lá que a
// conferência vale.

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

// ---------------------------------------------------------------------------

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
