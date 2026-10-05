import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { aplicarTamanho, lerTamanho } from './lib/tamanhoTexto'

// Antes de desenhar a tela, para não piscar no tamanho errado.
aplicarTamanho(lerTamanho())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
