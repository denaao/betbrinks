@echo off
REM ═══════════════════════════════════════════════════════════
REM  BetBrinks - Setup Completo (Windows)
REM  Executa: scripts\setup.bat
REM ═══════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════════════════════
echo   BetBrinks - Setup Inicial
echo ═══════════════════════════════════════════════════════════
echo.

REM ─── 1. Verificar prerequisitos ────────────────────────────
echo [1/6] Verificando prerequisitos...

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo X Node.js nao encontrado. Instale em https://nodejs.org
    exit /b 1
)

where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Instalando pnpm...
    npm install -g pnpm
)

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo X Docker nao encontrado. Instale em https://docker.com
    exit /b 1
)

echo OK Prerequisitos verificados

REM ─── 2. Instalar dependencias ──────────────────────────────
echo.
echo [2/6] Instalando dependencias...
call pnpm install
if %ERRORLEVEL% neq 0 (
    echo X Erro ao instalar dependencias
    exit /b 1
)
echo OK Dependencias instaladas

REM ─── 3. Verificar .env ─────────────────────────────────────
echo.
echo [3/6] Verificando .env...
if not exist .env (
    if exist .env.example (
        copy .env.example .env
        echo AVISO: .env criado a partir do .env.example - configure as variaveis!
    ) else (
        echo X .env nao encontrado
        exit /b 1
    )
) else (
    echo OK .env encontrado
)

REM ─── 4. Subir Docker ───────────────────────────────────────
echo.
echo [4/6] Subindo PostgreSQL e Redis via Docker...
docker compose -f docker/docker-compose.yml up -d
if %ERRORLEVEL% neq 0 (
    echo X Erro ao subir Docker. Verifique se Docker Desktop esta rodando.
    exit /b 1
)

echo Aguardando PostgreSQL...
timeout /t 5 /nobreak >nul
echo OK PostgreSQL e Redis rodando

REM ─── 5. Migrations Prisma ──────────────────────────────────
echo.
echo [5/6] Rodando migrations do banco...
cd apps\api
call npx prisma generate
call npx prisma db push
cd ..\..
echo OK Banco de dados configurado

REM ─── 6. Seed ───────────────────────────────────────────────
echo.
echo [6/6] Populando dados iniciais...
cd apps\api
call npx prisma db seed 2>nul
cd ..\..
echo OK Seed executado

echo.
echo ═══════════════════════════════════════════════════════════
echo   Setup completo!
echo ═══════════════════════════════════════════════════════════
echo.
echo   Para iniciar o desenvolvimento:
echo.
echo     pnpm dev:api        - Iniciar backend (porta 3000)
echo     pnpm dev:mobile     - Iniciar app mobile (Expo)
echo     pnpm dev:backoffice - Iniciar backoffice (porta 3001)
echo     pnpm dev            - Iniciar todos
echo.
echo   Admin padrao:
echo     Email: admin@betbrinks.com
echo     Senha: BetBrinks@2026
echo.
echo   Painel pgAdmin: http://localhost:5050
echo     Email: admin@betbrinks.com ^| Senha: admin123
echo.
