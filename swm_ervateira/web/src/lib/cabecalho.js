import { createContext, useContext } from 'react'

export const ContextoDoCabecalho = createContext(null)

export function useNoDoCabecalho() {
  return useContext(ContextoDoCabecalho)
}
