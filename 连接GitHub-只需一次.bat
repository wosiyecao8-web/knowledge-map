@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Knowledge Map - 第一次连接 GitHub

echo ========================================
echo      Knowledge Map 第一次连接 GitHub
echo ========================================
echo.

echo 这一步只需要做一次。
echo 连接成功后，以后更新只需双击“更新并启动.bat”。
echo.

where git >nul 2>nul
if errorlevel 1 goto :need_git
goto :git_ready

:need_git
echo 没有检测到 Git。
echo.
echo 可以让 Windows 的 winget 自动安装 Git for Windows。
choice /C YN /N /M "现在自动安装 Git？[Y/N]: "
if errorlevel 2 goto :git_cancel

where winget >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 没有找到 winget。
  echo 请安装 Git for Windows 后，再重新双击本文件：
  echo https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)

echo.
echo 正在安装 Git for Windows...
winget install --id Git.Git -e --source winget
if errorlevel 1 (
  echo.
  echo [错误] Git 自动安装失败。可以手动安装：
  echo https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)

echo.
echo Git 已安装。为了让 Windows 刷新 PATH，请关闭这个窗口，
echo 然后重新双击“连接GitHub-只需一次.bat”。
echo.
pause
exit /b 0

:git_cancel
echo.
echo 已取消。你仍然可以使用“启动游戏.bat”正常玩，
echo 只是暂时不能一键从 GitHub 更新。
echo.
pause
exit /b 0

:git_ready
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  git init -b main
  if errorlevel 1 (
    echo [错误] Git 初始化失败。
    pause
    exit /b 1
  )
  git add .
  git -c user.name="Knowledge Map" -c user.email="local@knowledge-map.invalid" commit -m "Initial Knowledge Map project"
)

for /f "delims=" %%R in ('git branch --show-current') do set CURRENT_BRANCH=%%R
if /I not "!CURRENT_BRANCH!"=="main" git branch -M main

echo.
echo 第 1 步：浏览器将打开 GitHub 的“新建仓库”页面。
echo 请创建一个空仓库，推荐名称：knowledge-map
echo.
echo 重要：不要勾选 README、.gitignore 或 License。
echo.
start "" "https://github.com/new"
pause

echo.
echo 第 2 步：创建完成后，复制仓库的 HTTPS 地址。
echo 例如：https://github.com/your-name/knowledge-map.git
echo.
set /p REPO_URL=把 GitHub 仓库 HTTPS 地址粘贴到这里，然后按 Enter: 

if "%REPO_URL%"=="" (
  echo [取消] 没有输入仓库地址。
  pause
  exit /b 1
)

git remote remove origin >nul 2>nul
git remote add origin "%REPO_URL%"
if errorlevel 1 (
  echo [错误] 无法设置 GitHub 地址。
  pause
  exit /b 1
)

echo.
echo 正在第一次上传到 GitHub...
echo 如果 Git 要求登录，按浏览器提示登录你的 GitHub 账号即可。
git push -u origin main
if errorlevel 1 (
  echo.
  echo [上传失败] 常见原因：
  echo 1. 仓库不是空仓库；
  echo 2. GitHub 登录没有完成；
  echo 3. 仓库地址粘贴错误。
  echo.
  echo 把上面的报错发给 ChatGPT，我可以继续帮你处理。
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo 连接成功！
echo ========================================
echo.
echo 以后：
echo - 玩游戏：双击“启动游戏.bat”
echo - ChatGPT 改完后：双击“更新并启动.bat”
echo.
echo 最后，请把下面这个 GitHub 地址发给 ChatGPT 一次：
echo %REPO_URL%
echo.
pause
exit /b 0
