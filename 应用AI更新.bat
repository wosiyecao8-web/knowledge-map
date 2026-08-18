@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title Knowledge Map - AI 更新工具

echo.
echo ==========================================
echo        Knowledge Map - AI 更新工具
echo ==========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [错误] 找不到 Git。
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [错误] 找不到 npm。
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前文件夹不是 Git 项目。
    echo 请把这个文件放在 KnowledgeMap 项目根目录。
    pause
    exit /b 1
)

echo [1/6] 检查本地项目...

git status --porcelain > "%TEMP%\knowledge-map-status.txt"

for %%A in ("%TEMP%\knowledge-map-status.txt") do (
    if not %%~zA==0 goto DIRTY
)

echo [2/6] 获取 GitHub 最新版本...

git pull --ff-only
if errorlevel 1 (
    echo.
    echo [错误] 无法从 GitHub 获取最新版本。
    pause
    exit /b 1
)

echo.
echo [3/6] 读取剪贴板中的 AI 补丁...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Clipboard -Raw | Set-Content -LiteralPath '%TEMP%\knowledge-map-ai.patch' -Encoding utf8"

if errorlevel 1 (
    echo.
    echo [错误] 无法读取剪贴板。
    pause
    exit /b 1
)

set "PATCH=%TEMP%\knowledge-map-ai.patch"

for %%A in ("%PATCH%") do (
    if %%~zA==0 (
        echo.
        echo [错误] 剪贴板是空的。
        pause
        exit /b 1
    )
)

echo 正在检查补丁...

git apply --check --ignore-space-change --ignore-whitespace "%PATCH%"
if errorlevel 1 (
    echo.
    echo ==========================================
    echo          补丁检查失败
    echo ==========================================
    echo.
    echo 没有修改任何游戏文件。
    echo 请把上面的错误信息发给 ChatGPT。
    echo.
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [4/6] 应用修改...

git apply --ignore-space-change --ignore-whitespace "%PATCH%"
if errorlevel 1 (
    echo.
    echo [错误] 补丁应用失败。
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [5/6] 检查游戏...

if not exist "node_modules\" (
    echo 正在安装项目依赖...
    call npm.cmd install
    if errorlevel 1 goto BUILD_FAILED
)

call npm.cmd run build
if errorlevel 1 goto BUILD_FAILED

echo.
echo 构建检查通过。

echo.
echo [6/6] 保存并上传 GitHub...

git add -A

for /f %%D in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%D"

git commit -m "AI update %STAMP%"
if errorlevel 1 (
    echo.
    echo [错误] Git 提交失败。
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    echo.
    echo [错误] 上传 GitHub 失败。
    echo 修改已经保存在你的电脑上。
    pause
    exit /b 1
)

del "%PATCH%" >nul 2>&1
del "%TEMP%\knowledge-map-status.txt" >nul 2>&1

echo.
echo ==========================================
echo             AI 更新成功
echo ==========================================
echo.
echo 本地游戏：已更新
echo GitHub：已更新
echo 构建检查：通过
echo.

choice /C YN /N /M "现在启动游戏吗？ [Y/N] "

if errorlevel 2 goto END

if exist "启动游戏.bat" (
    start "" "启动游戏.bat"
)

:END
echo.
pause
exit /b 0


:BUILD_FAILED
echo.
echo ==========================================
echo        游戏检查失败，正在撤销
echo ==========================================
echo.

git reset --hard HEAD >nul 2>&1

echo 已经恢复到更新前版本。
echo 没有提交到 GitHub。
echo.
echo 把上面的构建错误发给 ChatGPT。
echo.

del "%PATCH%" >nul 2>&1
pause
exit /b 1


:DIRTY
echo.
echo ==========================================
echo        本地还有尚未保存的修改
echo ==========================================
echo.

git status --short

echo.
echo 为了避免覆盖你的文件，AI 更新已经停止。
echo 把上面的内容发给 ChatGPT。
echo.

del "%TEMP%\knowledge-map-status.txt" >nul 2>&1
pause
exit /b 1