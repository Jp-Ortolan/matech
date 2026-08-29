// ---------------------------------------------------------------------------
// APP · rotas e proteção de acesso
// ---------------------------------------------------------------------------
// Define qual endereço mostra qual página.
//
// A <RotaProtegida> é a guarda do front: se não houver usuário logado, manda
// para o login em vez de renderizar a página. Vale repetir: isso é
// conveniência de navegação, não segurança — quem protege os dados é o
// middleware de autenticação no back-end.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProvedorAutenticacao, useAutenticacao } from './contexto/Autenticacao'
import { ROTA_INICIAL, telaDe, itemVisivel } from './lib/acesso'
import Layout from './componentes/Layout'
import Login from './paginas/Login'
import Dashboard from './paginas/Dashboard'
import Recebimento from './paginas/Recebimento'
import Avaliacoes from './paginas/Avaliacoes'
import CampoPagina from './paginas/Campo'
import SincronizacaoPagina from './paginas/Sincronizacao'
import Produtores from './paginas/Produtores'
import MateriaPrima from './paginas/MateriaPrima'
import Pagamentos from './paginas/Pagamentos'
import Relatorios from './paginas/Relatorios'
import Configuracoes from './paginas/Configuracoes'
import Usuarios from './paginas/Usuarios'

function RotaProtegida({ children }) {
  const { autenticado } = useAutenticacao()
  // replace evita que o botão "voltar" retorne para a página protegida
  return autenticado ? children : <Navigate to="/login" replace />
}

/**
 * Guarda de perfil de uma tela.
 *
 * Manda quem não tem o perfil para a tela inicial dele, em vez de mostrar uma
 * página vazia com 403 no console. É a mesma declaração que o menu usa, em
 * lib/acesso.js — e é conveniência de navegação, e não segurança: sem esta
 * linha o usuário chegaria à tela e ela não carregaria nada, porque a API
 * recusa a requisição. Quem protege o dado é o permitir()/apenas() no
 * servidor.
 */
function RotaDaTela({ para, children }) {
  const { usuario, podeFazer, ehAdministrador } = useAutenticacao()
  const tela = telaDe(para)
  if (tela && !itemVisivel(tela, { podeFazer, ehAdministrador })) {
    return <Navigate to={ROTA_INICIAL[usuario?.perfil] || '/'} replace />
  }
  return children
}

/** Endereço desconhecido: volta para onde este perfil começa. */
function ParaOInicio() {
  const { usuario } = useAutenticacao()
  return <Navigate to={ROTA_INICIAL[usuario?.perfil] || '/'} replace />
}

export default function App() {
  return (
    <ProvedorAutenticacao>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/pesagem" element={<Recebimento />} />
            {/* O endereço antigo continua respondendo: um link guardado nos
                favoritos de alguém não pode virar tela de erro. */}
            <Route path="/recebimento" element={<Navigate to="/pesagem" replace />} />
            <Route path="/avaliacoes" element={<RotaDaTela para="/avaliacoes"><Avaliacoes /></RotaDaTela>} />
            <Route path="/campo" element={<RotaDaTela para="/campo"><CampoPagina /></RotaDaTela>} />
            <Route path="/sincronizacao" element={<RotaDaTela para="/sincronizacao"><SincronizacaoPagina /></RotaDaTela>} />
            <Route path="/produtores" element={<Produtores />} />
            <Route path="/materia-prima" element={<MateriaPrima />} />
            <Route path="/pagamentos" element={<RotaDaTela para="/pagamentos"><Pagamentos /></RotaDaTela>} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />

            <Route
              path="/usuarios"
              element={
                <RotaDaTela para="/usuarios">
                  <Usuarios />
                </RotaDaTela>
              }
            />
          </Route>

          {/* qualquer endereço desconhecido volta para a tela inicial do perfil */}
          <Route path="*" element={<ParaOInicio />} />
        </Routes>
      </BrowserRouter>
    </ProvedorAutenticacao>
  )
}
