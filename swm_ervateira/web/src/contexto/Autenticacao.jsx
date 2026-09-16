import { createContext, useContext, useState, useCallback } from 'react'
import { auth } from '../api/recursos'
import { lerUsuario } from '../api/client'
import { PERFIL_ADMINISTRADOR } from '../lib/permissoes'

const ContextoAutenticacao = createContext(null)

export function ProvedorAutenticacao({ children }) {
  const [usuario, setUsuario] = useState(() => lerUsuario())

  const entrar = useCallback(async (login, senha) => {
    const u = await auth.entrar(login, senha)
    setUsuario(u)
    return u
  }, [])

  const sair = useCallback(() => {
    auth.sair()
    setUsuario(null)
  }, [])

  const valor = {
    usuario,
    autenticado: Boolean(usuario),
    entrar,
    sair,
    podeFazer: (...perfis) =>
      Boolean(usuario) &&
      (usuario.perfil === 'ADMINISTRATIVO' ||
        usuario.perfil === PERFIL_ADMINISTRADOR ||
        perfis.includes(usuario.perfil)),

    ehAdministrador: usuario?.perfil === PERFIL_ADMINISTRADOR,
  }

  return <ContextoAutenticacao value={valor}>{children}</ContextoAutenticacao>
}

export function useAutenticacao() {
  const contexto = useContext(ContextoAutenticacao)
  if (!contexto) {
    throw new Error('useAutenticacao precisa estar dentro de <ProvedorAutenticacao>')
  }
  return contexto
}

export { NOME_PERFIL } from '../lib/permissoes'
