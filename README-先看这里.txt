Knowledge Map —— 以后固定使用这个文件夹

你以后不需要再下载完整压缩包。

【平时玩】
双击：启动游戏.bat

第一次启动时，它会自动执行 npm install。以后一般不会重复安装。
窗口不要关；关掉黑色窗口就等于关闭本地游戏服务器。

【以后 ChatGPT 改了游戏】
双击：更新并启动.bat

它会从同一个 GitHub 仓库拉取最新代码，然后启动游戏。

【第一次连接 GitHub】
双击：连接GitHub-只需一次.bat

脚本会打开 GitHub 创建仓库页面。创建一个“空仓库”（不要勾 README / .gitignore / License），
然后把仓库 HTTPS 地址粘贴回脚本即可。

例如：
https://github.com/你的用户名/knowledge-map.git

连接成功之后，请把这个 GitHub 仓库地址发给 ChatGPT 一次。
以后 ChatGPT 就可以持续修改同一个仓库，而不是再发新的 ZIP。

注意：
游戏编辑器里的地图/内容存档主要保存在浏览器本地存储中。正常 git pull 不会清掉它。
重要内容仍建议定期使用游戏里的 JSON 导出功能备份。
