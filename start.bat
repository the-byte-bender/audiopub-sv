@echo off
setlocal enabledelayedexpansion

REM Definir caminho completo do mysql
set "MYSQL_PATH=C:\Program Files\MariaDB 12.0\bin\mysql.exe"

echo ========================================
echo AudioPub - Inicializacao Automatica
echo ========================================
echo.

REM Verificar se o mysql existe no caminho
if not exist "%MYSQL_PATH%" (
    echo [ERRO] MySQL nao encontrado em: %MYSQL_PATH%
    echo Verifique a versao do MariaDB instalada e atualize o script.
    pause
    exit /b 1
)

REM Verificar se o arquivo .env existe
if not exist ".env" (
    echo [1/6] Arquivo .env nao encontrado. Criando a partir do .env.example...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [!] ATENCAO: Configure o arquivo .env com suas credenciais antes de continuar!
        echo [!] Edite o arquivo .env e execute este script novamente.
        pause
        exit /b 1
    ) else (
        echo [ERRO] Arquivo .env.example nao encontrado!
        pause
        exit /b 1
    )
) else (
    echo [1/6] Arquivo .env encontrado.
)

REM Carregar variaveis do .env
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    set "line=%%a"
    REM Ignorar linhas vazias e comentarios
    if not "!line:~0,1!"=="#" if not "!line!"=="" (
        set "%%a=%%b"
    )
)

REM Verificar se as variaveis essenciais existao
if "%DATABASE_NAME%"=="" (
    echo [ERRO] DATABASE_NAME nao configurado no .env!
    pause
    exit /b 1
)
if "%DATABASE_USER%"=="" (
    echo [ERRO] DATABASE_USER nao configurado no .env!
    pause
    exit /b 1
)
if "%JWT_SECRET%"=="" (
    echo [ERRO] JWT_SECRET nao configurado no .env!
    pause
    exit /b 1
)

echo [2/6] Verificando servico MariaDB...
REM Verificar se o MariaDB service esta rodando
sc query mariadb >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Servico MariaDB nao encontrado. Tentando iniciar...
    net start mariadb >nul 2>&1
    if errorlevel 1 (
        echo [ERRO] Nao foi possivel iniciar o servico MariaDB.
        echo Verifique se o MariaDB esta instalado corretamente.
        echo Tente iniciar manualmente pelo Gerenciador de Servicos (services.msc)
        pause
        exit /b 1
    )
) else (
    REM Tentar iniciar se nao estiver rodando
    for /f "tokens=3" %%A in ('sc query mariadb ^| findstr STATE') do set SERVICE_STATE=%%A
    if "!SERVICE_STATE!"=="STOPPED" (
        echo [AVISO] MariaDB esta parado. Iniciando...
        net start mariadb >nul 2>&1
        if errorlevel 1 (
            echo [ERRO] Nao foi possivel iniciar MariaDB.
            pause
            exit /b 1
        )
        REM Aguardar um pouco para o servico iniciar
        timeout /t 3 /nobreak
    ) else (
        echo MariaDB esta rodando.
    )
)

echo [3/6] Testando conexao com banco de dados...
REM Testar conexao
"%MYSQL_PATH%" -u %DATABASE_USER% -p%DATABASE_PASSWORD% -e "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Nao foi possivel conectar ao MariaDB/MySQL!
    echo.
    echo Verifique:
    echo - Se o servico MariaDB esta rodando
    echo - Se o usuario "%DATABASE_USER%" existe
    echo - Se a senha esta correta
    echo - Se voce consegue conectar com: mysql -u %DATABASE_USER% -p
    echo.
    pause
    exit /b 1
)
echo Conexao com MariaDB OK!

echo [4/6] Verificando/criando database...
REM Verificar se o database existe, senao criar
"%MYSQL_PATH%" -u %DATABASE_USER% -p%DATABASE_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS %DATABASE_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if errorlevel 1 (
    echo [ERRO] Nao foi possivel criar o database.
    pause
    exit /b 1
)
echo Database verificado/criado com sucesso.

echo [5/6] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo [6/6] Executando migrations...
call npm run db:migrate
if errorlevel 1 (
    echo [ERRO] Falha ao executar migrations.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Servidor iniciando...
echo Pressione Ctrl+C para parar
echo ========================================
echo.
call npm run dev

endlocal
