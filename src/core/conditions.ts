import type { Condition, ContentBundle, GameState } from './types';

export function evaluateCondition(condition: Condition, state: GameState, content?: ContentBundle): boolean {
  switch (condition.type) {
    case 'always':
      return true;
    case 'resource_at_least':
      return (state.resources[condition.resourceId] ?? 0) >= condition.amount;
    case 'producer_level_at_least':
      return (state.producerLevels[condition.producerId] ?? 0) >= condition.level;
    case 'upgrade_level_at_least':
      return (state.upgradeLevels[condition.upgradeId] ?? 0) >= condition.level;
    case 'upgrade_tag_count_at_least': {
      if (!content) return false;
      const count = content.upgrades.reduce((total, upgrade) => total + (upgrade.tags.includes(condition.tag) && (state.upgradeLevels[upgrade.id] ?? 0) > 0 ? 1 : 0), 0);
      return count >= condition.count;
    }
    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, state, content));
    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, state, content));
    case 'not':
      return !evaluateCondition(condition.condition, state, content);
  }
}

export function describeCondition(condition: Condition, lookup: (id: string) => string): string {
  switch (condition.type) {
    case 'always':
      return '立即可用';
    case 'resource_at_least':
      return `${lookup(condition.resourceId)} ≥ ${condition.amount}`;
    case 'producer_level_at_least':
      return `${lookup(condition.producerId)} Lv.${condition.level}`;
    case 'upgrade_level_at_least':
      return `${lookup(condition.upgradeId)} Lv.${condition.level}`;
    case 'upgrade_tag_count_at_least':
      return `掌握 #${condition.tag} 技能 ≥ ${condition.count} 个`;
    case 'and':
      return condition.conditions.map((c) => describeCondition(c, lookup)).join(' 且 ');
    case 'or':
      return condition.conditions.map((c) => describeCondition(c, lookup)).join(' 或 ');
    case 'not':
      return `非（${describeCondition(condition.condition, lookup)}）`;
  }
}
