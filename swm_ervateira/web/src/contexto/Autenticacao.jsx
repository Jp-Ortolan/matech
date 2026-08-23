// ---------------------------------------------------------------------------
// CONTEXTO · autenticação
// ---------------------------------------------------------------------------
// Um "contexto" no React é um dado que fica disponível para toda a árvore de
// componentes sem precisar ser passado de pai para filho em cada nível.
//
// Aqui ele guarda quem está logado. A barra superior precisa do nome, o menu
// precisa do perfil para esconder itens, e o App precisa saber se deve mandar
// para o login. Todos leem daqui.

import { createContext, useContext, useState, useCallback } from 'react'
import { auth } from '../api/recursos'
import { lerUsuario } from '../api/client'

const ContextoAutenticacao = createContext(null)

export function ProvedorAutenticacao({ children }) {
  // Começa lendo o que já está guardado no navegador: assim, ao recarregar a
  // página, o usuário continua logado em vez de cair no login toda vez.
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
    // Verifica se o usuário tem um dos perfis informados.
    // O administrativo passa em tudo, como no back-end.
    podeFazer: (...perfis) =>
      Boolean(usuario) && (usuario.perfil === 'ADMINISTRATIVO' || perfis.includes(usuario.perfil)),
  }

  return <ContextoAutenticacao value={valor}>{children}</ContextoAutenticacao>
}

/** Atalho para as telas: const { usuario, sair } = useAutenticacao() */
export function useAutenticacao() {
  const contexto = useContext(ContextoAutenticacao)
  if (!contexto) {
    throw new Error('useAutenticacao precisa estar dentro de <ProvedorAutenticacao>')
  }
  return contexto
}

/** Nome legível do perfil, para mostrar na interface. */
export const NOME_PERFIL = {
  OPERADOR_BALANCA: 'Operador de balança',
  ANALISTA_QUALIDADE: 'Analista de qualidade',
  COMPRADOR_AVALIADOR: 'Comprador / avaliador',
  ADMINISTRATIVO: 'Administrativo',
}
