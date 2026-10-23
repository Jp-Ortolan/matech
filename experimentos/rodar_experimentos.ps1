# ------------------------------------------------------------------
# MATECH - roda os experimentos do artigo (Tabelas 2, 3, 4 e 5)
# no seu computador, usando um banco PostgreSQL LOCAL so para testes.
#
# Como usar (PowerShell, dentro da pasta desenvolvimento\experimentos):
#   powershell -ExecutionPolicy Bypass -File .\rodar_experimentos.ps1
#
# O script NUNCA usa o banco publicado (Neon): ele troca o endereco do
# banco so dentro desta janela e para tudo se o endereco nao for local.
# ------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$pastaExp = $PSScriptRoot
$pastaApi = Join-Path $PSScriptRoot '..\swm_ervateira'
$data = Get-Date -Format 'dd-MM-yyyy_HH-mm'
$pastaResultados = Join-Path $pastaExp "resultados_$data"
New-Item -ItemType Directory -Force $pastaResultados | Out-Null
Start-Transcript -Path (Join-Path $pastaResultados 'log_completo.txt') | Out-Null

# 1) Senha do PostgreSQL local (a que voce definiu ao instalar o PostgreSQL 18)
$seg = Read-Host 'Senha do usuario postgres do seu PostgreSQL local' -AsSecureString
$senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seg))
$senhaUrl = [uri]::EscapeDataString($senha)

# 2) Variaveis valem so nesta janela; o .env do projeto nao e alterado
$banco = 'matech_experimentos'
$env:DATABASE_URL = "postgresql://postgres:$senhaUrl@localhost:5432/$banco"
$env:DATABASE_URL_UNPOOLED = $env:DATABASE_URL
$env:PORT = '3333'
$env:API = 'http://localhost:3333'
$env:SENHA_SEED = 'matech123'
$env:NODE_ENV = 'development'
# Chave dos tokens so para este teste local (o calculos.js carrega o codigo
# da API a partir desta pasta e nao encontra o .env do projeto)
$env:JWT_SECRET = 'chave-local-somente-para-os-experimentos-do-tcc'

# Trava de seguranca: so continua se o banco for local
if ($env:DATABASE_URL -notmatch '@localhost:5432/matech_experimentos$') {
  throw 'Endereco do banco nao e local. Parando para nao mexer no banco publicado.'
}

# 3) Cria o banco de testes (se ja existir, apaga e cria de novo, vazio)
$env:PGPASSWORD = $senha
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
& $psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS $banco;"
& $psql -U postgres -h localhost -c "CREATE DATABASE $banco;"
if ($LASTEXITCODE -ne 0) { throw 'Nao consegui criar o banco. Confira a senha do postgres.' }

# 4) Cria as tabelas e os usuarios de teste nesse banco local
Push-Location $pastaApi
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar as tabelas.' }
npm run seed
if ($LASTEXITCODE -ne 0) { throw 'Falha no seed.' }

# 5) Sobe a API em segundo plano, na porta 3333
$api = Start-Process node -ArgumentList 'src/server.js' -NoNewWindow -PassThru -WorkingDirectory $pastaApi `
  -RedirectStandardOutput (Join-Path $pastaResultados 'api_saida.txt') `
  -RedirectStandardError (Join-Path $pastaResultados 'api_erros.txt')
Pop-Location
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try { Invoke-RestMethod 'http://localhost:3333/health' | Out-Null; $ok = $true; break } catch {}
}
if (-not $ok) { Stop-Process -Id $api.Id -Force; throw 'A API nao subiu. Veja api_erros.txt.' }
Write-Host 'API no ar em http://localhost:3333 (banco local de testes)' -ForegroundColor Green

# 6) Experimentos, na mesma ordem usada no artigo
$experimentos = @(
  @{ arq = 'sincronizacao.js';  nome = 'Tabela 2 - sincronizacao com falhas (9 execucoes x 300 operacoes)' },
  @{ arq = 'mesmo_produtor.js'; nome = 'Secao 5.6 - mesmo produtor em dois aparelhos' },
  @{ arq = 'validacao.js';      nome = 'Tabela 3 - validacao das entradas' },
  @{ arq = 'calculos.js';       nome = 'Secao 5.8 - conferencia dos calculos' },
  @{ arq = 'contar_base.js antes_da_tabela4'; nome = 'Tamanho da base antes da Tabela 4' },
  @{ arq = 'desempenho.js';     nome = 'Tabela 4 - tempo de resposta (200 execucoes)' },
  @{ arq = 'contar_base.js antes_da_tabela5'; nome = 'Tamanho da base antes da Tabela 5' },
  @{ arq = 'carga.js';          nome = 'Tabela 5 - teste de carga (1, 10, 25 e 50 usuarios)' }
)
Push-Location $pastaExp
try {
  foreach ($e in $experimentos) {
    Write-Host ''
    Write-Host ">>> $($e.nome)" -ForegroundColor Cyan
    $t0 = Get-Date
    node ($e.arq -split ' ')
    if ($LASTEXITCODE -ne 0) { throw "Falhou: $($e.arq)" }
    Write-Host ("    terminou em {0:N0} s" -f ((Get-Date) - $t0).TotalSeconds)
  }
  Get-ChildItem 'resultado_*.json' | Move-Item -Destination $pastaResultados -Force
}
finally {
  Pop-Location
  Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
}

# 7) Registra a configuracao da maquina (vai para a nota das Tabelas 4 e 5)
$cpu = Get-CimInstance Win32_Processor
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$so  = (Get-CimInstance Win32_OperatingSystem).Caption
$pg  = (& $psql --version)
@"
Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm')
Processador: $($cpu.Name) ($($cpu.NumberOfCores) nucleos, $($cpu.NumberOfLogicalProcessors) threads)
Memoria: $ram GB
Sistema: $so
Node.js: $(node -v)
$pg
"@ | Set-Content (Join-Path $pastaResultados 'ambiente.txt')

Write-Host ''
Write-Host "Pronto! Resultados em: $pastaResultados" -ForegroundColor Green
Stop-Transcript | Out-Null
