@echo off
cd /d "%~dp0"
echo ========================================
echo   PUBLICIDAD MINUTO 86 - INICIANDO
echo ========================================
echo.
if not exist node_modules (
  echo Instalando dependencias, espere...
  npm install
)
echo.
echo Servidor iniciado.
echo Panel Admin: http://localhost:3010/admin.html
echo Overlay OBS: http://localhost:3010/overlay.html
echo.
npm start
pause
