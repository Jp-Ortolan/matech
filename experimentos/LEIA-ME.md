# Experimentos do artigo

Scripts que geram os resultados da Seção 5 do artigo. Cada script chama a API
em funcionamento, com um banco PostgreSQL só para testes (nunca o publicado).

| Script | Onde aparece no artigo |
|---|---|
| `sincronizacao.js` | Tabela 2 e Seção 5.6 (conflitos) |
| `mesmo_produtor.js` | Seção 5.6 (mesmo produtor em dois aparelhos) |
| `validacao.js` | Tabela 3 |
| `calculos.js` | Seção 5.8 |
| `contar_base.js` | tamanho da base antes das Tabelas 4 e 5 |
| `desempenho.js` | Tabela 4 (200 execuções de cada operação) |
| `carga.js` | Tabela 5 (1, 10, 25 e 50 usuários, 30 s cada) |

As falhas de rede da Tabela 2 são sorteadas com semente fixa, por isso os
números se repetem em qualquer máquina. Os tempos das Tabelas 4 e 5 variam
um pouco a cada rodada e dependem da máquina.

## Rodadas guardadas

- `resultados_servidor_linux_23-10-2026_17-05`: servidor Linux de testes
  (2 núcleos, 7 GB, Node.js 22, PostgreSQL 16), o mesmo ambiente descrito na
  nota da Tabela 4.
- `resultados_22-10-2026_17-08`: notebook do autor (Ryzen 7 6800H, 15 GB,
  Windows 11, Node.js 24, PostgreSQL 18).

Nas duas, a sincronização, os conflitos, os cadastros repetidos e a validação
deram exatamente os mesmos números, todas as ordens e itens conferiram, e
nenhuma requisição falhou no teste de carga.

## Como rodar

No Windows, dentro desta pasta:

```
powershell -ExecutionPolicy Bypass -File .\rodar_experimentos.ps1
```

O script cria um banco local `matech_experimentos`, sobe a API na porta 3333,
roda os experimentos na ordem do artigo e salva tudo numa pasta
`resultados_<data>`, junto com a configuração da máquina (`ambiente.txt`).
