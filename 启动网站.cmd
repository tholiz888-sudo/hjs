@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24，然后重新打开此文件。
  pause
  exit /b 1
)
echo 启动后请用浏览器打开 http://localhost:3000
echo 使用期间请保持此窗口打开。关闭窗口将停止网站。
node server.js
pause
