# ---------------------------------------------------------------------------
# MATECH · monta o repositório Git com histórico por módulo
# ---------------------------------------------------------------------------
# Rode UMA vez, a partir desta pasta:
#
#     cd "C:\Users\joaop\Documents\Faculdade 2026\Tcc\desenvolvimento"
#     powershell -ExecutionPolicy Bypass -File .\montar-repositorio.ps1
#
# O QUE ELE FAZ, e o que NÃO faz:
#
# Faz  · cria o repositório, aplica o .gitignore e agrupa os arquivos em
#        commits por módulo, cada um com uma mensagem que explica o que é.
#
# Não  · não inventa datas. Todos os commits são de hoje, porque é hoje que o
#        repositório está sendo criado. Um histórico com datas retroativas
#        seria mentira, e mentira em repositório é fácil de detectar.
#
# O valor está em o repositório ficar NAVEGÁVEL: `git log --oneline` conta a
# estrutura do sistema em vinte linhas, em vez de um commit de 17 mil.

# ---------------------------------------------------------------------------
# POR QUE NAO SE USA ErrorActionPreference = "Stop" AQUI
# ---------------------------------------------------------------------------
# Com "Stop", o PowerShell trata QUALQUER coisa que um programa externo escreva
# no stderr como erro fatal. E o git escreve avisos inofensivos no stderr o
# tempo todo — o de fim de linha (LF/CRLF) e o mais comum. A primeira versao
# deste script morria no primeiro `git add` por causa de um aviso.
#
# A checagem correta de um comando externo nao e o stderr: e o codigo de saida,
# $LASTEXITCODE. E o que a funcao Git() abaixo verifica.
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "MATECH - montagem do repositorio" -ForegroundColor Green
Write-Host ""

# --- limpeza de tentativa anterior ----------------------------------------
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "  removida a trava .git/index.lock" -ForegroundColor DarkGray
}
Get-ChildItem ".git" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^[A-Za-z0-9]{7}$' } |
    ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "  removido arquivo temporario .git/$($_.Name)" -ForegroundColor DarkGray
    }

# --- repositorio e identidade ---------------------------------------------
if (-not (Test-Path ".git")) { git init -q -b main }

# Identidade LOCAL deste repositorio. Nao mexe na configuracao global.
git config user.name  "Joao Pedro Ortolan Pereira"
git config user.email "joaopedroortolanpereira@gmail.com"

# Fim de linha: os arquivos ficam no repositorio exatamente como estao no
# disco. Sem conversao, sem aviso. Num projeto de uma pessoa so, converter
# LF para CRLF na ida e na volta so produz ruido — e foi o ruido que derrubou
# a primeira execucao.
git config core.autocrlf false
git config core.safecrlf false

# --- ja existe historico? --------------------------------------------------
$jaTemCommits = $false
git rev-parse --verify HEAD 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $jaTemCommits = $true }

if ($jaTemCommits) {
    Write-Host ""
    Write-Host "  Este repositorio JA tem commits." -ForegroundColor Yellow
    Write-Host "  O script foi feito para rodar uma vez, num repositorio limpo." -ForegroundColor Yellow
    Write-Host "  Historico atual:" -ForegroundColor Yellow
    git log --oneline
    Write-Host ""
    $resposta = Read-Host "  Continuar assim mesmo e acrescentar commits? (s/N)"
    if ($resposta -ne "s") {
        Write-Host "  Cancelado. Nada foi alterado." -ForegroundColor Yellow
        exit
    }
}

# --- funcao de commit ------------------------------------------------------
# Adiciona os caminhos pedidos e so faz o commit se houver algo preparado.
# Um caminho que ainda nao exista nao derruba o script.
function Commit([string]$mensagem, [string[]]$caminhos) {
    foreach ($c in $caminhos) {
        if (Test-Path $c) {
            # 2>&1 junta o stderr ao stdout, e o Out-Null descarta os dois.
            # Assim o aviso do git nao vira erro nem polui a tela.
            git add -- $c 2>&1 | Out-Null
        }
    }

    $preparado = git diff --cached --name-only 2>&1
    if ($LASTEXITCODE -ne 0 -or -not $preparado) {
        Write-Host ("  [--] nada a versionar  {0}" -f $mensagem) -ForegroundColor DarkYellow
        return
    }

    git commit -q -m $mensagem 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $n = ($preparado | Measure-Object).Count
        Write-Host ("  [ok] {0,-5} arquivo(s)  {1}" -f $n, $mensagem) -ForegroundColor DarkGray
    } else {
        Write-Host ("  [ERRO] falhou       {0}" -f $mensagem) -ForegroundColor Red
    }
}

# ===========================================================================
# A SEQUENCIA
# ---------------------------------------------------------------------------
# A ordem segue a dependencia real do sistema: primeiro o que sustenta, depois
# o que se apoia nele. Quem clonar e ler o log de baixo para cima entende como
# o MATECH e montado.
# ===========================================================================

Commit "chore: configuracao do repositorio e modelo de variaveis de ambiente" `
    @(".gitignore", ".env.exemplo", "montar-repositorio.ps1")

Commit "feat(banco): modelo de dados com 12 tabelas e migracoes versionadas" `
    @("swm_ervateira/prisma", "swm_ervateira/prisma.config.ts")

Commit "chore(api): dependencias e scripts do projeto" `
    @("swm_ervateira/package.json", "swm_ervateira/package-lock.json", "swm_ervateira/.gitignore")

Commit "feat(api): montagem do Express, configuracao de ambiente e tratamento de erros" `
    @("swm_ervateira/src/app.js", "swm_ervateira/src/server.js",
      "swm_ervateira/src/config", "swm_ervateira/src/lib/prisma.js",
      "swm_ervateira/src/middlewares")

Commit "feat(auth): login com JWT, hash bcrypt e autorizacao por perfil" `
    @("swm_ervateira/src/modules/auth")

Commit "feat(documentos): validacao de CPF e CNPJ por digito verificador" `
    @("swm_ervateira/src/lib/documentos.js", "swm_ervateira/src/lib/documentos.test.js")

Commit "feat(produtores): cadastro, consulta e coerencia da forma de pagamento" `
    @("swm_ervateira/src/modules/produtores")

Commit "feat(cargas): pesagem, ticket sequencial e calculo do pagamento (RF10)" `
    @("swm_ervateira/src/modules/cargas")

Commit "feat(motoristas): cadastro de motoristas e veiculos, com tara por placa" `
    @("swm_ervateira/src/modules/motoristas")

Commit "feat(qualidade): analise de laboratorio e desconto por percentual de palito" `
    @("swm_ervateira/src/modules/qualidade")

Commit "feat(pagamentos): ordens agrupadas por periodo, com copia da chave Pix" `
    @("swm_ervateira/src/modules/pagamentos")

Commit "feat(sincronizacao): recebimento idempotente do lote coletado sem conexao" `
    @("swm_ervateira/src/modules/sincronizacao")

Commit "feat(avaliacoes): consulta das avaliacoes de campo e suas fotos" `
    @("swm_ervateira/src/modules/avaliacoes")

Commit "docs(api): README do servico e requisicoes de exemplo" `
    @("swm_ervateira/README.md", "swm_ervateira/requisicoes.http")

Commit "feat(web): projeto Vite, tema da marca e componentes base" `
    @("swm_ervateira/web/package.json", "swm_ervateira/web/package-lock.json",
      "swm_ervateira/web/vite.config.js", "swm_ervateira/web/index.html",
      "swm_ervateira/web/.gitignore", "swm_ervateira/web/.oxlintrc.json",
      "swm_ervateira/web/README.md", "swm_ervateira/web/public",
      "swm_ervateira/web/src/main.jsx", "swm_ervateira/web/src/index.css",
      "swm_ervateira/web/src/App.css", "swm_ervateira/web/src/assets")

Commit "feat(web): moldura, autenticacao e cliente unico da API" `
    @("swm_ervateira/web/src/App.jsx", "swm_ervateira/web/src/componentes",
      "swm_ervateira/web/src/contexto", "swm_ervateira/web/src/api",
      "swm_ervateira/web/src/lib")

Commit "feat(web): telas de operacao - painel, pesagem e analise de qualidade" `
    @("swm_ervateira/web/src/paginas/Login.jsx",
      "swm_ervateira/web/src/paginas/Dashboard.jsx",
      "swm_ervateira/web/src/paginas/Recebimento.jsx",
      "swm_ervateira/web/src/paginas/Avaliacoes.jsx")

Commit "feat(web): cadastros, financeiro, relatorios e configuracoes" `
    @("swm_ervateira/web/src/paginas/Produtores.jsx",
      "swm_ervateira/web/src/paginas/MateriaPrima.jsx",
      "swm_ervateira/web/src/paginas/Pagamentos.jsx",
      "swm_ervateira/web/src/paginas/Relatorios.jsx",
      "swm_ervateira/web/src/paginas/Configuracoes.jsx")

Commit "feat(web): telas de campo e painel de sincronizacao" `
    @("swm_ervateira/web/src/paginas/Campo.jsx",
      "swm_ervateira/web/src/paginas/Sincronizacao.jsx")

Commit "chore(app): projeto Flutter e dependencias" `
    @("matech_app/pubspec.yaml", "matech_app/pubspec.lock",
      "matech_app/analysis_options.yaml", "matech_app/.gitignore",
      "matech_app/.metadata")

Commit "feat(app): banco local em SQLite e modelos de dominio" `
    @("matech_app/lib/config.dart", "matech_app/lib/modelos",
      "matech_app/lib/dados/banco_local.dart")

Commit "feat(app): DAOs com gravacao transacional do dado e da fila" `
    @("matech_app/lib/dados")

Commit "feat(app): politica de tentativas, leitura de token e identificadores" `
    @("matech_app/lib/servicos/politica_de_tentativas.dart",
      "matech_app/lib/servicos/token.dart",
      "matech_app/lib/servicos/identificadores.dart")

Commit "feat(app): cliente HTTP, sessao e sincronizador da fila offline" `
    @("matech_app/lib/servicos/api.dart", "matech_app/lib/servicos/sessao.dart",
      "matech_app/lib/servicos/sincronizador.dart")

Commit "feat(app): captura de localizacao e de fotos, com falhas nomeadas" `
    @("matech_app/lib/servicos/localizacao.dart",
      "matech_app/lib/servicos/captura_de_fotos.dart",
      "matech_app/lib/servicos/arquivos.dart")

Commit "feat(app): telas de coleta em campo e de sincronizacao" `
    @("matech_app/lib/main.dart", "matech_app/lib/telas", "matech_app/lib/widgets")

Commit "test(app): testes unitarios e de widget" `
    @("matech_app/test")

Commit "chore(app): plataforma Android e permissoes de camera, GPS e rede" `
    @("matech_app/android")

Commit "docs(app): README do aplicativo movel" `
    @("matech_app/README.md")

# Rede de seguranca: qualquer coisa que os caminhos acima nao tenham pego.
Commit "chore: arquivos restantes do projeto" @(".")

# ===========================================================================
Write-Host ""
Write-Host "Pronto. Historico:" -ForegroundColor Green
Write-Host ""
git log --oneline --reverse
Write-Host ""

$total = (git ls-files | Measure-Object).Count
Write-Host "$total arquivos versionados." -ForegroundColor Green
Write-Host ""

# --- conferencia de segredos ----------------------------------------------
# Feita aqui, e nao deixada como recomendacao, porque segredo que entra no
# historico do git nao sai apagando o arquivo depois: fica no objeto do commit.
$vazados = git ls-files | Select-String -Pattern '\.env$|node_modules/|uploads/'
if ($vazados) {
    Write-Host "ATENCAO: arquivos que NAO deveriam estar versionados:" -ForegroundColor Red
    $vazados | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "NAO empurre para o GitHub. Avise antes de continuar." -ForegroundColor Red
} else {
    Write-Host "Nenhum segredo versionado. Pode empurrar." -ForegroundColor Green
    Write-Host ""
    Write-Host "  git push -u origin main --force" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  (o --force existe porque o repositorio no GitHub tem um" -ForegroundColor DarkGray
    Write-Host "   'first commit' avulso que nao faz parte deste historico)" -ForegroundColor DarkGray
}
Write-Host ""
