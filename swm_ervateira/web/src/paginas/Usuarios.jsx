// ---------------------------------------------------------------------------
// PÁGINA · usuários do sistema  (somente ADMINISTRADOR)
// ---------------------------------------------------------------------------
// Abrir e fechar contas de acesso. É a única tela do sistema que não trata de
// erva-mate — e por isso vive numa seção própria do menu, separada da
// operação, e fora de Configurações, que é a conta de quem está logado.
//
// TRÊS DECISÕES QUE VALEM EXPLICAR:
//
//   · O LOGIN NÃO SE EDITA. Ele aparece na auditoria de quem pesou a carga e
//     de quem lançou a análise; trocá-lo faria o histórico apontar para um
//     nome que não existia na época. Conta errada se desativa e se cria outra.
//
//   · NINGUÉM SE DESATIVA nem se rebaixa. Um administrador que fizesse isso
//     perderia acesso justamente à tela que desfaria o erro, e a única saída
//     seria mexer no banco à mão. O servidor recusa as duas coisas; a tela
//     apenas não oferece.
//
//   · A SENHA NUNCA É EXIBIDA, nem em campo preenchido. O que existe é um
//     campo vazio de senha NOVA. O banco guarda só o hash — nem o servidor
//     conseguiria mostrar a senha atual se quisesse.

import { useCallback, useEffect, useState } from 'react'
import { usuarios as apiUsuarios } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, Tabela, Campo, Selecao, Botao, Etiqueta,
  Carregando, Erro, Sucesso
} from '../componentes/ui'
import { PERFIS } from '../lib/permissoes'
import { formatar } from '../lib/formatar'

export default function Usuarios() {
  const { usuario: eu } = useAutenticacao()

  const [lista, setLista] = useState([])
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState('')
  const [formulario, setFormulario] = useState(null)  // null | 'novo' | usuário
  const [trocandoSenha, setTrocandoSenha] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const r = await apiUsuarios.listar()
      setLista(r.usuarios)
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscar() }, [buscar])

  // Filtro do navegador: a lista de contas de uma ervateira cabe inteira numa
  // requisição, e ir ao servidor a cada tecla seria ida perdida.
  const termo = busca.trim().toLowerCase()
  const visiveis = lista.filter(
    (u) =>
      (!termo || u.nome.toLowerCase().includes(termo) || u.usuario.includes(termo)) &&
      (!situacao || String(u.ativo) === situacao)
  )

  function concluir(mensagem) {
    setFormulario(null)
    setTrocandoSenha(null)
    setAviso(mensagem)
    buscar()
  }

  async function alternarAtivo(u) {
    setErro(null)
    setAviso('')
    try {
      await apiUsuarios.atualizar(u.id, { ativo: !u.ativo })
      setAviso(`${u.nome} ${u.ativo ? 'desativado' : 'reativado'}.`)
      buscar()
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Usuários">
        <Botao
          variante="primario"
          onClick={() => { setAviso(''); setTrocandoSenha(null); setFormulario((f) => (f === 'novo' ? null : 'novo')) }}
        >
          {formulario === 'novo' ? 'Fechar' : '+ Novo usuário'}
        </Botao>
      </CabecalhoPagina>

      <Filtros>
        <Campo
          rotulo="Buscar por nome ou usuário"
          className="min-w-[220px] flex-[2]"
          placeholder="digite para filtrar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao rotulo="Situação" className="flex-1" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </Selecao>
        <span className="flex-1" />
      </Filtros>

      {formulario && (
        <FormularioUsuario
          key={formulario === 'novo' ? 'novo' : formulario.id}
          usuario={formulario === 'novo' ? null : formulario}
          souEu={formulario !== 'novo' && formulario.id === eu?.id}
          aoConcluir={concluir}
          aoCancelar={() => setFormulario(null)}
        />
      )}

      {trocandoSenha && (
        <FormularioSenha
          key={trocandoSenha.id}
          usuario={trocandoSenha}
          aoConcluir={concluir}
          aoCancelar={() => setTrocandoSenha(null)}
        />
      )}

      {aviso && <div className="mb-3"><Sucesso texto={aviso} /></div>}
      <Erro erro={erro} />

      <Painel titulo="Contas de acesso" acao={carregando ? 'buscando...' : `${visiveis.length} de ${lista.length}`}>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[
              { chave: 'usuario', titulo: 'Usuário', forte: true, truncar: 170 },
              {
                chave: 'nome', titulo: 'Nome', truncar: 230,
                render: (u) => (
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate" title={u.nome}>{u.nome}</span>
                    {u.id === eu?.id && <Etiqueta tom="verde">você</Etiqueta>}
                  </span>
                ),
              },
              { chave: 'perfil', titulo: 'Perfil', render: (u) => rotuloDoPerfil(u.perfil) },
              {
                chave: 'acesso', titulo: 'Último acesso', oculta: 'lg',
                render: (u) => (u.ultimoAcesso ? formatar.dataHora(u.ultimoAcesso) : 'nunca entrou'),
              },
              {
                chave: 'ativo', titulo: 'Status',
                render: (u) => (
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium text-cinza-600">
                    <span className={`h-[7px] w-[7px] rounded-[1px] ${u.ativo ? 'bg-mate-500' : 'bg-cinza-400'}`} />
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                ),
              },
              {
                chave: 'acoes', titulo: '', alinhar: 'direita',
                render: (u) => (
                  <span className="flex justify-end gap-3 whitespace-nowrap">
                    <Acao onClick={() => { setAviso(''); setTrocandoSenha(null); setFormulario(u) }}>editar</Acao>
                    <Acao onClick={() => { setAviso(''); setFormulario(null); setTrocandoSenha(u) }}>senha</Acao>
                    {/* Desativar a si mesmo é o único erro deste módulo sem
                        conserto pela interface. O botão simplesmente não
                        aparece — e o servidor recusa, se alguém insistir. */}
                    {u.id !== eu?.id && (
                      <Acao onClick={() => alternarAtivo(u)}>{u.ativo ? 'desativar' : 'reativar'}</Acao>
                    )}
                  </span>
                ),
              },
            ]}
            dados={visiveis}
            vazio={lista.length ? 'Nenhum usuário com esses filtros.' : 'Nenhum usuário cadastrado.'}
          />
        )}
      </Painel>
    </>
  )
}

function Acao({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-cinza-400 hover:text-mate-700"
    >
      {children}
    </button>
  )
}

function rotuloDoPerfil(id) {
  return PERFIS.find((p) => p.id === id)?.rotulo || id
}

// ---------------------------------------------------------------------------
// Cadastro e edição
// ---------------------------------------------------------------------------
// O mesmo formulário serve para os dois casos, como em Produtores: duplicá-lo
// é o caminho mais curto para as duas versões divergirem com o tempo.
//
// A diferença entre criar e editar é só o que fica disponível: no cadastro há
// login e senha inicial; na edição os dois somem, porque o login é imutável e
// a senha tem fluxo próprio, sem exibir a atual.

const VAZIO = { nome: '', usuario: '', senha: '', perfil: 'OPERADOR_BALANCA', ativo: true }

function FormularioUsuario({ usuario, souEu, aoConcluir, aoCancelar }) {
  const editando = Boolean(usuario)

  const [form, setForm] = useState(() =>
    usuario
      ? { ...VAZIO, nome: usuario.nome, usuario: usuario.usuario, perfil: usuario.perfil, ativo: usuario.ativo }
      : VAZIO
  )
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const loginInvalido = !editando && form.usuario !== '' && !/^[a-z0-9._-]{3,}$/.test(form.usuario)
  const podeSalvar =
    form.nome.trim().length >= 3 &&
    (editando || (form.usuario.length >= 3 && !loginInvalido && form.senha.length >= 6))

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      if (editando) {
        await apiUsuarios.atualizar(usuario.id, {
          nome: form.nome,
          perfil: form.perfil,
          ativo: form.ativo,
        })
        aoConcluir(`Cadastro de ${form.nome} atualizado.`)
      } else {
        await apiUsuarios.criar({
          nome: form.nome,
          usuario: form.usuario,
          senha: form.senha,
          perfil: form.perfil,
          ativo: form.ativo,
        })
        aoConcluir(`Usuário ${form.usuario} criado.`)
      }
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo={editando ? `Editar · ${usuario.usuario}` : 'Novo usuário'} className="mb-3">
      <form onSubmit={enviar} className="flex flex-col gap-3 px-3 py-3">
        <Erro erro={erro} />

        <div className="flex flex-wrap gap-2 xl:gap-2.5">
          <Campo
            rotulo="Nome *"
            className="min-w-[220px] flex-[2]"
            value={form.nome}
            onChange={(e) => alterar('nome', e.target.value)}
          />

          {editando ? (
            <Campo rotulo="Usuário" className="flex-1" value={form.usuario} disabled readOnly />
          ) : (
            <Campo
              rotulo="Usuário *"
              className="flex-1"
              placeholder="nome.sobrenome"
              value={form.usuario}
              onChange={(e) => alterar('usuario', e.target.value.toLowerCase())}
            />
          )}

          {!editando && (
            <Campo
              rotulo="Senha inicial *"
              className="flex-1"
              type="password"
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => alterar('senha', e.target.value)}
            />
          )}

          <Selecao
            rotulo="Perfil *"
            className="flex-1"
            value={form.perfil}
            onChange={(e) => alterar('perfil', e.target.value)}
            disabled={souEu}
          >
            {PERFIS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </Selecao>

          <Selecao
            rotulo="Status"
            className="flex-1"
            value={String(form.ativo)}
            onChange={(e) => alterar('ativo', e.target.value === 'true')}
            disabled={souEu}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Selecao>
        </div>

        {loginInvalido && (
          <p className="text-[10.5px] font-medium text-perigo">
            O usuário aceita apenas letras, números, ponto, hífen e sublinhado, com ao menos 3 caracteres.
          </p>
        )}
        {!editando && form.senha !== '' && form.senha.length < 6 && (
          <p className="text-[10.5px] text-cinza-400">A senha precisa ter ao menos 6 caracteres.</p>
        )}
        {editando && (
          <p className="text-[10.5px] text-cinza-400">
            O usuário não muda: ele identifica quem pesou e quem analisou no histórico.
            {souEu && ' Perfil e status da própria conta não se alteram aqui.'}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Botao type="button" onClick={aoCancelar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={!podeSalvar || enviando}>
            {enviando ? 'Gravando...' : editando ? 'Salvar alterações' : 'Criar usuário'}
          </Botao>
        </div>
      </form>
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Redefinição de senha pelo administrador
// ---------------------------------------------------------------------------
// Não pede a senha atual, e é de propósito: quem usa esta função é o
// administrador atendendo alguém que ESQUECEU a senha. Exigir a antiga
// tornaria a função inútil justamente no caso para o qual ela existe.
//
// Quem troca a própria senha passa por outro caminho — Configurações — e lá
// a senha atual é pedida.

function FormularioSenha({ usuario, aoConcluir, aoCancelar }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const naoConfere = confirmacao !== '' && senha !== confirmacao
  const podeSalvar = senha.length >= 6 && senha === confirmacao

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await apiUsuarios.redefinirSenha(usuario.id, senha)
      aoConcluir(`Senha de ${usuario.usuario} redefinida.`)
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo={`Nova senha · ${usuario.usuario}`} className="mb-3">
      <form onSubmit={enviar} className="flex flex-col gap-3 px-3 py-3">
        <Erro erro={erro} />

        <div className="flex flex-wrap items-end gap-2 xl:gap-2.5">
          <Campo
            rotulo="Nova senha *"
            className="flex-1"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Campo
            rotulo="Repetir a nova senha *"
            className="flex-1"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
          <Botao type="button" onClick={aoCancelar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={!podeSalvar || enviando}>
            {enviando ? 'Gravando...' : 'Redefinir senha'}
          </Botao>
        </div>

        {naoConfere && (
          <p className="text-[10.5px] font-medium text-perigo">As duas senhas não conferem.</p>
        )}
        <p className="text-[10.5px] text-cinza-400">
          A senha atual não é exibida em lugar nenhum: o banco guarda apenas o hash.
        </p>
      </form>
    </Painel>
  )
}
