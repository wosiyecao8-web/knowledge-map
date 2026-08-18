# Knowledge Idle v0.1 — Architecture

## 目标

这个仓库首先是一个 **数据驱动 Incremental Game 的最小骨架**，不是完整的人生知识游戏。

核心原则：

1. 新增“微积分 / 钢琴 / 素描”应该优先增加数据，而不是增加 `CalculusManager`、`MusicSystem`、`ArtSystem`。
2. UI 不直接改游戏数值；UI 只能调用 `GameEngine`。
3. 内部引用永远使用稳定 ID；显示名称可以变化。
4. `Condition`、`Effect`、`Tag` 是跨系统复用的基础积木。
5. 存档带版本号，未来结构变化要通过 migration 演进。

## 目录

```text
src/
├── core/
│   ├── types.ts              # 数据契约
│   ├── conditions.ts         # 统一条件系统
│   ├── effects.ts            # 统一效果计算
│   ├── eventBus.ts           # 系统间事件总线
│   ├── contentValidation.ts  # 内容引用校验
│   ├── save.ts               # 版本化存档
│   └── gameEngine.ts         # 游戏运行时 API
├── content/
│   └── defaultContent.ts     # 示例内容（数学 + 音乐）
├── editor/
│   └── editor.ts             # 最小内容编辑器
├── ui/
│   └── format.ts
├── main.ts                   # UI composition + game loop
└── style.css
public/assets/                # 默认素材
```

## 核心对象

### Resource
任何可以积累或花费的数值。核心逻辑不假定只有 Knowledge。

### Producer
拥有价格、等级、标签和一组 `production`。每秒产出 = `amountPerSecond × level × multiplier`。

### Upgrade
购买后提供一组 Effect。当前支持 Producer 倍率、点击倍率、即时资源奖励。

### Condition
所有解锁条件和事件触发条件使用统一结构。当前支持 always、资源阈值、Producer 等级、Upgrade 等级、AND / OR / NOT。

### Event
使用 Condition 触发；选择项使用 Effect 发放结果。剧情不直接写进 ProducerSystem。

## 为什么 Tag 很重要

`upgrade.music.theory` 不引用 Piano，而是引用 `tag: music`。未来新增 Guitar 只要包含 `music` 标签，旧的 Music Theory 自动对它生效。

## 如何添加 Producer

推荐路径：打开应用 → 内容编辑器 → “新增 / 修改生产者”。

也可以直接在 `src/content/defaultContent.ts` 增加一个 `ProducerDefinition`。只要其 Resource 引用存在，就不需要修改 GameEngine。

## 如何替换 Producer 图片

Producer 的图片来自 `image` 字段。

可选方法：

- 编辑器中填写 URL；
- 编辑器中上传本地图片（保存为 Data URL，随项目快照进入 localStorage）；
- 把静态图片放进 `public/assets/`，然后填写 `/assets/name.png`。

UI 不知道“微积分图片”是什么，只读取 `producer.image`。

## 如何添加 Upgrade

编辑器当前提供一个最常用的“按 Tag 乘倍率”表单。更复杂的 Upgrade 可以直接通过数据指定 `effects`。

如果未来发现多个领域都需要同一种新效果，应扩展 `Effect` union + EffectSystem；不要给每个内容写特殊判断。

## 如何添加新领域

“领域”当前不是硬编码系统，只是 `category + tags + resources/producers/upgrades` 的组合。

例如美术：

1. 创建 `resource.art`。
2. 创建带 `art` 标签的 `producer.art.sketch`。
3. 创建面向 `tag: art` 的 Upgrade。

不需要 ArtSystem。

## 保存与兼容

localStorage 保存一个 `ProjectSnapshot`，包含：

- `snapshotVersion`
- `content`
- `state`

`GameState` 还有独立 `saveVersion`。当前都是 v1。以后修改字段时，应在 `save.ts` 增加显式 migration，而不是直接假设旧存档拥有新字段。

## Event Bus

GameEngine 会广播：

- `resourceChanged`
- `producerPurchased`
- `upgradePurchased`
- `eventTriggered`
- `stateChanged`
- `contentChanged`

未来 AchievementSystem、QuestSystem 等应优先监听这些事件，不要侵入 ProducerSystem。

## v0.1 刻意没有做

- 巨型技能树 / Node Graph Editor
- Prestige / Reincarnation
- Inventory / Equipment
- Offline Production
- Achievement
- Quest
- 多存档槽
- 完整 Event 编辑器
- 完整 Condition / Effect 可视化编辑器
- 图片文件持久化服务器

理由：这些都不是验证底层数据驱动架构所必需的。现在提前做会增加个人项目负担。

## 下一阶段推荐验收

在不修改 `src/core/` 的前提下：

1. 新建 `resource.art`。
2. 新建“素描练习” Producer。
3. 上传自己的图片。
4. 新建一个 `art` 标签倍率 Upgrade。
5. 确认数学和音乐原内容仍正常。

如果做到这一步仍不需要碰核心代码，说明第一层抽象成功。

## v0.2：知识地图层

v0.2 增加了一个独立的“表现/布局层”，Producer 与 Upgrade 都可以拥有：

```ts
graph?: {
  x: number;
  y: number;
  parentId?: string;
}
```

这里有一个非常重要的约束：

- `graph.parentId` 只表示“地图上从哪个节点连过来”。
- `unlockCondition` 才决定“什么时候真正出现/可购买”。

不要把这两个概念合并。以后节点可以被重新排版、改连接视觉结构，而不改变数值与解锁逻辑。

### 游戏地图

- 地图是大画布；点击空白区域调用统一 `engine.click()`。
- Producer 是大圆节点，Upgrade/Skill 是小圆节点。
- 只有满足解锁条件（或已经拥有）的节点才显示。
- 节点之间的曲线由 `graph.parentId` 生成。
- 平时生产只刷新 HUD 数字；只有节点结构变化时才重绘地图，避免 Idle tick 导致整页频繁重绘。

### 编辑器

编辑器与游戏使用同一套 ContentBundle：

- Palette 中拖入 Producer / Skill。
- Drop 后填写通用数据。
- 可以选择父节点，父节点可以是 Producer 或 Upgrade。
- Existing node 可以拖动更新 `graph.x/y`。
- 双击节点修改内容。
- 图片仍然属于数据字段，可使用 URL、assets 路径或上传后的 Data URL。

未来增加“成就节点、事件节点、物品节点”等视觉类型时，优先考虑它是否真的需要新的核心系统；如果只是显示方式不同，应继续复用 Condition / Effect / Event 等底层能力。

### 可扩展的技能数量门槛

Condition 新增 `upgrade_tag_count_at_least`，用于表达“掌握某个标签的技能达到 N 个”。这比硬编码 35 个技能 ID 更适合大型知识地图；以后新增同标签技能时，不需要回来修改旧节点。
