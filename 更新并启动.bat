@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Knowledge Map - 更新并启动

echo ========================================
echo        Knowledge Map 更新并启动
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [需要一次设置] 电脑上还没有 Git。
  echo 请先双击“连接GitHub-只需一次.bat”。
  echo.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo [需要一次设置] 当前文件夹还没有初始化 Git。
  echo 请先双击“连接GitHub-只需一次.bat”。
  echo.
  pause
  exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo [需要一次设置] 还没有连接 GitHub 仓库。
  echo 请先双击“连接GitHub-只需一次.bat”。
  echo.
  pause
  exit /b 1
)

echo 正在获取最新版本...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo [更新失败] Git 没有成功拉取最新代码。
  echo 如果你手动改过源代码，请先备份；也可以把这段报错发给 ChatGPT。
  echo.
  pause
  exit /b 1
)

echo.
echo 更新完成。现在启动游戏...
echo.
call "%~dp0启动游戏.bat"
exit /b %errorlevel%
