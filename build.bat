@echo off
REM Regenera todas as paginas do site a partir do conteudo em /data.
REM Basta dar dois cliques neste arquivo (precisa do Node.js instalado).
cd /d "%~dp0"
echo Gerando o site...
node tools\build.mjs
echo.
echo Pronto! Abra index.html no navegador.
pause
