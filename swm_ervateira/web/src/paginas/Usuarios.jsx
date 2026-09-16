import { useCallback, useEffect, useState } from 'react'
import { usuarios as apiUsuarios } from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, Tabela, Campo, Selecao, Botao, Etiqueta, Janela, LinhaDado,
  Carregando, Erro, Sucesso
} from '../componentes/ui'
import { PERFIS } from '../lib/permissoes'
import { formatar } from '../lib/formatar'
import { ICONE_DA_ACAO } from '../lib/icones'

export default function Usuarios() {
  const { usuario: eu } = useAutenticacao()

  const [lista, setLista] = useState([])
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState('')
  const [formulario, setFormulario] = useState(null)  // null | 'novo' | usuário
  const [fichaId, setFichaId] = useState(null)
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
          icone={formulario === 'novo' ? ICONE_DA_ACAO.limpar : ICONE_DA_ACAO.registrar}
        >
          {formulario === 'novo' ? 'Fechar' : 'Novo usuário'}
        </Botao>
      </CabecalhoPagina>

      <Filtros
        busca={(
          <Campo
            rotulo="Buscar por nome ou usuário"
            className="min-w-[220px] flex-1 max-w-[340px]"
            placeholder="digite para filtrar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}
        ativos={situacao === '' ? [] : [{
          chave: 'situacao',
          texto: situacao === 'true' ? 'Ativos' : 'Inativos',
        }]}
        aoRemover={() => setSituacao('')}
        aoLimpar={() => setSituacao('')}
      >
        <Selecao rotulo="Situação" className="flex-1" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </Selecao>
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
            ]}
            dados={visiveis}
            aoClicarLinha={(u) => { setAviso(''); setFichaId(u.id) }}
            linhaAtiva={fichaId}
            vazio={lista.length ? 'Nenhum usuário com esses filtros.' : 'Nenhum usuário cadastrado.'}
          />
        )}
      </Painel>
      {fichaId && (
        <Janela
          titulo={lista.find((u) => u.id === fichaId)?.nome || 'Ficha da conta'}
          subtitulo="Acesso, perfil e ações da conta"
          largura={620}
          aoFechar={() => setFichaId(null)}
        >
          <FichaDoUsuario
            usuario={lista.find((u) => u.id === fichaId)}
            ehVoceMesmo={fichaId === eu?.id}
            aoEditar={(u) => { setFichaId(null); setTrocandoSenha(null); setFormulario(u) }}
            aoTrocarSenha={(u) => { setFichaId(null); setFormulario(null); setTrocandoSenha(u) }}
            aoAlternarAtivo={(u) => { setFichaId(null); alternarAtivo(u) }}
          />
        </Janela>
      )}
    </>
  )
}

function FichaDoUsuario({ usuario, ehVoceMesmo, aoEditar, aoTrocarSenha, aoAlternarAtivo }) {
  if (!usuario) return null

  return (
    <Painel titulo={usuario.usuario} acao={ehVoceMesmo ? <Etiqueta tom="verde">você</Etiqueta> : null}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LinhaDado rotulo="Nome" valor={usuario.nome} />
          <LinhaDado rotulo="Login" valor={usuario.usuario} />
          <LinhaDado rotulo="Perfil" valor={rotuloDoPerfil(usuario.perfil)} />
          <LinhaDado rotulo="Situação" valor={usuario.ativo ? 'Ativa' : 'Inativa'} />
          <LinhaDado
            rotulo="Último acesso"
            valor={usuario.ultimoAcesso ? formatar.dataHora(usuario.ultimoAcesso) : 'nunca entrou'}
          />
          <LinhaDado rotulo="Criada em" valor={formatar.data(usuario.criadoEm)} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-borda pt-3">
          <Botao onClick={() => aoEditar(usuario)}>Editar cadastro</Botao>
          <Botao onClick={() => aoTrocarSenha(usuario)}>Redefinir senha</Botao>
          {!ehVoceMesmo && (
            <Botao
              variante={usuario.ativo ? 'perigo' : undefined}
              onClick={() => aoAlternarAtivo(usuario)}
            >
              {usuario.ativo ? 'Desativar acesso' : 'Reativar acesso'}
            </Botao>
          )}
        </div>
      </div>
    </Painel>
  )
}

function rotuloDoPerfil(id) {
  return PERFIS.find((p) => p.id === id)?.rotulo || id
}

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
    <Painel titulo={editando ? `Editar · ${usuario.usuario}` : 'Novo usuário'} className="mb-6">
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
    <Painel titulo={`Nova senha · ${usuario.usuario}`} className="mb-6">
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
