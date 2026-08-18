import type { ContentBundle, Effect, GameState, ProducerDefinition } from './types';

export function effectTargetsProducer(effect: Effect, producer: ProducerDefinition): boolean {
  if (effect.type !== 'producer_multiplier') return false;
  if (effect.target.kind === 'producer') return effect.target.id === producer.id;
  return producer.tags.includes(effect.target.id);
}

export function getProducerMultiplier(
  producer: ProducerDefinition,
  content: ContentBundle,
  state: GameState,
): number {
  let multiplier = 1;

  for (const upgrade of content.upgrades) {
    const level = state.upgradeLevels[upgrade.id] ?? 0;
    if (level <= 0) continue;

    for (const effect of upgrade.effects) {
      if (effect.type === 'producer_multiplier' && effectTargetsProducer(effect, producer)) {
        multiplier *= Math.pow(effect.value, level);
      }
    }
  }

  return multiplier;
}

export function getClickMultiplier(content: ContentBundle, state: GameState): number {
  let multiplier = 1;
  for (const upgrade of content.upgrades) {
    const level = state.upgradeLevels[upgrade.id] ?? 0;
    if (level <= 0) continue;
    for (const effect of upgrade.effects) {
      if (effect.type === 'click_multiplier') multiplier *= Math.pow(effect.value, level);
    }
  }
  return multiplier;
}

export function applyImmediateEffect(effect: Effect, state: GameState): void {
  if (effect.type === 'resource_add') {
    state.resources[effect.resourceId] = (state.resources[effect.resourceId] ?? 0) + effect.amount;
  }
}
