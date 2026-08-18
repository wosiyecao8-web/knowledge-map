@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title Knowledge Map - 应用AI更新

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
    echo [错误] 这个文件没有放在 KnowledgeMap Git 项目里。
    echo 请把“应用AI更新.bat”放到项目根目录。
    pause
    exit /b 1
)

echo [1/6] 检查本地项目...

git diff --quiet
if errorlevel 1 goto DIRTY

git diff --cached --quiet
if errorlevel 1 goto DIRTY

set "OTHER_UNTRACKED="
for /f "delims=" %%F in ('git -c core.quotepath=false ls-files --others --exclude-standard') do (
    if /I not "%%F"=="应用AI更新.bat" set "OTHER_UNTRACKED=1"
)

if defined OTHER_UNTRACKED goto DIRTY

echo [2/6] 获取 GitHub 最新版本...

git pull --ff-only
if errorlevel 1 (
    echo.
    echo [错误] 无法从 GitHub 更新。
    echo 把上面的报错发给 ChatGPT。
    pause
    exit /b 1
)

echo.
echo [3/6] 正在读取你复制的 AI 补丁...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$t=Get-Clipboard -Raw; ^
if([string]::IsNullOrWhiteSpace($t)){exit 2}; ^
$t=$t -replace '^\s*```(?:diff|patch)?[ \t]*\r?\n',''; ^
$t=$t -replace '\r?\n```[ \t]*\s*$',''; ^
[IO.File]::WriteAllText(($env:TEMP+'\knowledge-map-ai.patch'),$t,(New-Object Text.UTF8Encoding($false)))"

if errorlevel 1 (
    echo [错误] 剪贴板里没有找到 AI 更新补丁。
    echo.
    echo 请先在 ChatGPT 中复制我给你的 diff 补丁，
    echo 然后再双击这个文件。
    pause
    exit /b 1
)

set "PATCH=%TEMP%\knowledge-map-ai.patch"

echo 正在检查补丁是否适合当前版本...

git apply --check --whitespace=nowarn "%PATCH%"
if errorlevel 1 (
    echo.
    echo [错误] 这个补丁和你当前的游戏版本不匹配。
    echo 没有修改任何文件。
    echo.
    echo 把这里的报错发给 ChatGPT，我会重新生成补丁。
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [4/6] 应用 AI 修改...

git apply --whitespace=nowarn "%PATCH%"
if errorlevel 1 (
    echo [错误] 修改失败，没有继续操作。
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [5/6] 自动检查游戏能否正常构建...

if not exist "node_modules\" (
    echo 第一次运行，需要安装项目依赖...
    call npm.cmd install
    if errorlevel 1 goto BUILD_FAILED
)

call npm.cmd run build
if errorlevel 1 goto BUILD_FAILED

echo.
echo 构建检查通过。
echo.
echo [6/6] 保存修改并上传 GitHub...

git add -A

for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%D"

git commit -m "AI update %STAMP%"
if errorlevel 1 (
    echo.
    echo [错误] Git 提交失败。
    echo 文件已经修改，但还没有上传。
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    git push -u origin HEAD
)

if errorlevel 1 (
    echo.
    echo [警告] 游戏修改成功，但上传 GitHub 失败。
    echo 修改仍然保存在你的电脑上。
    echo 把上面的 Git 报错发给 ChatGPT。
    del "%PATCH%" >nul 2>&1
    pause
    exit /b 1
)

del "%PATCH%" >nul 2>&1

echo.
echo ==========================================
echo          AI 更新成功！
echo ==========================================
echo.
echo 本地项目：已经更新
echo GitHub：   已经上传
echo 构建检查：通过
echo.

choice /C YN /N /M "现在启动游戏吗？ [Y/N] "

if errorlevel 2 goto END

if exist "启动游戏.bat" (
    start "" "启动游戏.bat"
) else (
    echo 找不到“启动游戏.bat”。
)

:END
echo.
pause
exit /b 0


:BUILD_FAILED
echo.
echo ==========================================
echo        检查失败，正在自动撤销
echo ==========================================
echo.
echo AI 修改导致项目无法通过构建检查。
echo 不会提交，也不会上传到 GitHub。
echo.

git apply -R --check "%PATCH%" >nul 2>&1
if errorlevel 1 (
    echo [警告] 自动撤销失败。
    echo 请不要继续修改项目，把这个窗口的报错发给 ChatGPT。
) else (
    git apply -R "%PATCH%"
    echo 修改已经安全撤销。
)

del "%PATCH%" >nul 2>&1
pause
exit /b 1


:DIRTY
echo.
echo ==========================================
echo        检测到尚未保存的本地修改
echo ==========================================
echo.
echo 为了避免覆盖你的东西，本次 AI 更新已经停止。
echo.
git status --short
echo.
echo 把上面的内容发给 ChatGPT，我会告诉你怎么处理。
pause
exit /b 1