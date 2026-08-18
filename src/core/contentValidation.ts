import type { Condition, ContentBundle, Effect } from './types';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validateContent(content: ContentBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allItems = [...content.resources, ...content.producers, ...content.upgrades, ...content.events];
  const ids = new Set<string>();

  for (const item of allItems) {
    if (!item.id.trim()) issues.push({ level: 'error', message: '发现空 ID。' });
    if (ids.has(item.id)) issues.push({ level: 'error', message: `重复 ID：${item.id}` });
    ids.add(item.id);
  }

  const resourceIds = new Set(content.resources.map((x) => x.id));
  const producerIds = new Set(content.producers.map((x) => x.id));
  const upgradeIds = new Set(content.upgrades.map((x) => x.id));

  const inspectCondition = (condition: Condition, owner: string) => {
    switch (condition.type) {
      case 'resource_at_least':
        if (!resourceIds.has(condition.resourceId)) issues.push({ level: 'error', message: `${owner} 引用了不存在的资源 ${condition.resourceId}` });
        break;
      case 'producer_level_at_least':
        if (!producerIds.has(condition.producerId)) issues.push({ level: 'error', message: `${owner} 引用了不存在的生产者 ${condition.producerId}` });
        break;
      case 'upgrade_level_at_least':
        if (!upgradeIds.has(condition.upgradeId)) issues.push({ level: 'error', message: `${owner} 引用了不存在的升级 ${condition.upgradeId}` });
        break;
      case 'upgrade_tag_count_at_least':
        if (!condition.tag.trim()) issues.push({ level: 'error', message: `${owner} 的技能标签条件为空。` });
        break;
      case 'and':
      case 'or':
        condition.conditions.forEach((x) => inspectCondition(x, owner));
        break;
      case 'not':
        inspectCondition(condition.condition, owner);
        break;
    }
  };

  const inspectEffect = (effect: Effect, owner: string) => {
    if (effect.type === 'resource_add' && !resourceIds.has(effect.resourceId)) {
      issues.push({ level: 'error', message: `${owner} 的效果引用了不存在的资源 ${effect.resourceId}` });
    }
    if (effect.type === 'producer_multiplier' && effect.target.kind === 'producer' && !producerIds.has(effect.target.id)) {
      issues.push({ level: 'error', message: `${owner} 的效果引用了不存在的生产者 ${effect.target.id}` });
    }
  };

  for (const producer of content.producers) {
    producer.baseCost.forEach((c) => {
      if (!resourceIds.has(c.resourceId)) issues.push({ level: 'error', message: `${producer.id} 的价格引用了不存在的资源 ${c.resourceId}` });
    });
    producer.production.forEach((p) => {
      if (!resourceIds.has(p.resourceId)) issues.push({ level: 'error', message: `${producer.id} 的产出引用了不存在的资源 ${p.resourceId}` });
    });
    inspectCondition(producer.unlockCondition, producer.id);
  }

  for (const upgrade of content.upgrades) {
    upgrade.cost.forEach((c) => {
      if (!resourceIds.has(c.resourceId)) issues.push({ level: 'error', message: `${upgrade.id} 的价格引用了不存在的资源 ${c.resourceId}` });
    });
    inspectCondition(upgrade.unlockCondition, upgrade.id);
    upgrade.effects.forEach((e) => inspectEffect(e, upgrade.id));
  }

  for (const event of content.events) {
    inspectCondition(event.triggerCondition, event.id);
    event.choices.forEach((choice) => {
      if (choice.condition) inspectCondition(choice.condition, `${event.id}/${choice.id}`);
      choice.effects.forEach((effect) => inspectEffect(effect, `${event.id}/${choice.id}`));
    });
  }


  const graphNodeIds = new Set([...content.producers.map((x) => x.id), ...content.upgrades.map((x) => x.id)]);
  for (const node of [...content.producers, ...content.upgrades]) {
    if (node.graph?.parentId && !graphNodeIds.has(node.graph.parentId)) {
      issues.push({ level: 'error', message: `${node.id} 的地图连接引用了不存在的节点 ${node.graph.parentId}` });
    }
    if (node.graph && (!Number.isFinite(node.graph.x) || !Number.isFinite(node.graph.y))) {
      issues.push({ level: 'error', message: `${node.id} 的地图坐标无效。` });
    }
  }

  if (content.resources.length === 0) issues.push({ level: 'warning', message: '项目没有任何资源。' });
  return issues;
}
