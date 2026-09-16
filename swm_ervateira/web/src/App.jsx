import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProvedorAutenticacao, useAutenticacao } from './contexto/Autenticacao'
import { ROTA_INICIAL, telaDe, itemVisivel } from './lib/acesso'
import Layout from './componentes/Layout'
import Login from './paginas/Login'
import Recebimento from './paginas/Recebimento'
import Avaliacoes from './paginas/Avaliacoes'
import CampoPagina from './paginas/Campo'
import Auditoria from './paginas/Auditoria'
import Produtores from './paginas/Produtores'
import Pagamentos from './paginas/Pagamentos'
import Relatorios from './paginas/Relatorios'
import Configuracoes from './paginas/Configuracoes'
import Usuarios from './paginas/Usuarios'

function RotaProtegida({ children }) {
  const { autenticado } = useAutenticacao()
  return autenticado ? children : <Navigate to="/login" replace />
}

function RotaDaTela({ para, children }) {
  const { usuario, podeFazer, ehAdministrador } = useAutenticacao()
  const tela = telaDe(para)
  if (tela && !itemVisivel(tela, { podeFazer, ehAdministrador })) {
    return <Navigate to={ROTA_INICIAL[usuario?.perfil] || '/'} replace />
  }
  return children
}

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
            <Route path="/" element={<ParaOInicio />} />
            <Route path="/pesagem" element={<Recebimento />} />
            <Route path="/recebimento" element={<Navigate to="/pesagem" replace />} />
            <Route path="/avaliacoes" element={<RotaDaTela para="/avaliacoes"><Avaliacoes /></RotaDaTela>} />
            <Route path="/campo" element={<RotaDaTela para="/campo"><CampoPagina /></RotaDaTela>} />
            <Route path="/sincronizacao" element={<Navigate to="/campo" replace />} />
            <Route path="/auditoria" element={<RotaDaTela para="/auditoria"><Auditoria /></RotaDaTela>} />
            <Route path="/produtores" element={<Produtores />} />
            <Route path="/materia-prima" element={<Navigate to="/relatorios" replace />} />
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

          <Route path="*" element={<ParaOInicio />} />
        </Routes>
      </BrowserRouter>
    </ProvedorAutenticacao>
  )
}
