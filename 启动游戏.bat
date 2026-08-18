@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Knowledge Map - 启动游戏

echo ========================================
echo          Knowledge Map 启动器
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js。
  echo 请先安装 Node.js LTS，然后重新双击本文件。
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 npm.cmd。
  echo Node.js 可能安装不完整。请重新安装 Node.js LTS。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [首次运行] 正在安装项目依赖，只需要做一次...
  call npm.cmd install
  if errorlevel 1 goto :install_error
  echo.
)

echo 正在启动游戏，浏览器会自动打开...
echo.
echo 提示：保持这个窗口开启；关闭窗口会停止游戏服务器。
echo.
call npm.cmd run dev -- --host 127.0.0.1 --open
exit /b %errorlevel%

:install_error
echo.
echo [错误] npm install 没有成功。
echo 请检查网络连接后重新双击“启动游戏.bat”。
echo.
pause
exit /b 1
