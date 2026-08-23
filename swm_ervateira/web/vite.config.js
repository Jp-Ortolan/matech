import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // "proxy" faz o navegador achar que a API está no mesmo endereço do site.
    // Toda chamada para /api é repassada para o servidor Express na porta 3000.
    // Vantagem: no código do front basta escrever fetch('/api/cargas'), sem
    // endereço completo, e não há problema de CORS durante o desenvolvimento.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      // As fotos do erval são servidas pela API em /uploads. Sem esta linha
      // o <img> apontaria para a porta 5173, onde elas não existem, e a tela
      // de campo mostraria molduras quebradas.
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
