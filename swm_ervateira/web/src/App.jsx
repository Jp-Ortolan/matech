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

function RotaProtegida({ children }) {
  const { autenticado } = useAutenticacao()
  // replace evita que o botão "voltar" retorne para a página protegida
  return autenticado ? children : <Navigate to="/login" replace />
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
            <Route path="/avaliacoes" element={<Avaliacoes />} />
            <Route path="/campo" element={<CampoPagina />} />
            <Route path="/sincronizacao" element={<SincronizacaoPagina />} />
            <Route path="/produtores" element={<Produtores />} />
            <Route path="/materia-prima" element={<MateriaPrima />} />
            <Route path="/pagamentos" element={<Pagamentos />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>

          {/* qualquer endereço desconhecido volta para o painel */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorAutenticacao>
  )
}
