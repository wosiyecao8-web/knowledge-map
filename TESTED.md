# Tested — v0.2

本版本完成以下检查：

- `tsc --noEmit`：通过。
- Core smoke test：通过。
  - 地图点击对应的 `engine.click()` 可增加知识。
  - 第一生产者可购买并持续生产。
  - Producer 达到等级后 Skill 可解锁。
  - 购买 3 个 `learning` 标签技能后，`upgrade_tag_count_at_least` 条件正确解锁第二生产者。
- 编辑器数据模型检查：Producer / Upgrade 都使用可选 `graph {x,y,parentId}`，地图布局与真正的 unlockCondition 分离。
- 内容验证会检查无效 graph parent 引用和无效坐标。

当前执行环境无法从网络完成 Vite 依赖安装，因此没有在此环境中启动浏览器开发服务器；TypeScript 全项目类型检查已通过。用户本机已有 Node/npm 后可用 `npm.cmd install`、`npm.cmd run dev` 启动。
