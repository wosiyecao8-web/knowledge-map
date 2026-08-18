import { evaluateCondition } from './conditions';
import { applyImmediateEffect, getClickMultiplier, getProducerMultiplier } from './effects';
import { EventBus } from './eventBus';
import { createInitialState, normalizeState } from './save';
import type { ContentBundle, EventDefinition, GameState, ProducerDefinition, UpgradeDefinition } from './types';

export class GameEngine {
  readonly events = new EventBus();
  content: ContentBundle;
  state: GameState;
  private pendingEventIds = new Set<string>();

  constructor(content: ContentBundle, state?: GameState) {
    this.content = structuredClone(content);
    this.state = state ? normalizeState(state, this.content) : createInitialState(this.content);
  }

  replaceContent(content: ContentBundle): void {
    this.content = structuredClone(content);
    this.state = normalizeState(this.state, this.content);
    this.events.emit('contentChanged', undefined);
    this.notifyChange();
  }

  replaceState(state: GameState): void {
    this.state = normalizeState(state, this.content);
    this.events.emit('gameLoaded', undefined);
    this.notifyChange();
  }

  click(resourceId = 'resource.knowledge', baseAmount = 1): void {
    const amount = baseAmount * getClickMultiplier(this.content, this.state);
    this.addResource(resourceId, amount);
    this.state.lifetimeClicks += 1;
    this.notifyChange();
  }

  addResource(resourceId: string, amount: number): void {
    this.state.resources[resourceId] = (this.state.resources[resourceId] ?? 0) + amount;
    this.events.emit('resourceChanged', { resourceId, amount: this.state.resources[resourceId] });
  }

  canAfford(costs: { resourceId: string; amount: number }[]): boolean {
    return costs.every((cost) => (this.state.resources[cost.resourceId] ?? 0) >= cost.amount);
  }

  private spend(costs: { resourceId: string; amount: number }[]): boolean {
    if (!this.canAfford(costs)) return false;
    for (const cost of costs) this.state.resources[cost.resourceId] -= cost.amount;
    return true;
  }

  producerCost(producer: ProducerDefinition): { resourceId: string; amount: number }[] {
    const level = this.state.producerLevels[producer.id] ?? 0;
    return producer.baseCost.map((cost) => ({
      resourceId: cost.resourceId,
      amount: cost.amount * Math.pow(producer.costScaling, level),
    }));
  }

  isProducerAvailable(producer: ProducerDefinition): boolean {
    return producer.enabled !== false && evaluateCondition(producer.unlockCondition, this.state, this.content);
  }

  purchaseProducer(producerId: string): boolean {
    const producer = this.content.producers.find((x) => x.id === producerId);
    if (!producer || !this.isProducerAvailable(producer)) return false;
    const costs = this.producerCost(producer);
    if (!this.spend(costs)) return false;
    const level = (this.state.producerLevels[producerId] ?? 0) + 1;
    this.state.producerLevels[producerId] = level;
    this.events.emit('producerPurchased', { producerId, level });
    this.notifyChange();
    return true;
  }

  isUpgradeAvailable(upgrade: UpgradeDefinition): boolean {
    const level = this.state.upgradeLevels[upgrade.id] ?? 0;
    const max = upgrade.maxLevel ?? (upgrade.repeatable ? Number.POSITIVE_INFINITY : 1);
    return level < max && evaluateCondition(upgrade.unlockCondition, this.state, this.content);
  }

  purchaseUpgrade(upgradeId: string): boolean {
    const upgrade = this.content.upgrades.find((x) => x.id === upgradeId);
    if (!upgrade || !this.isUpgradeAvailable(upgrade) || !this.spend(upgrade.cost)) return false;
    const level = (this.state.upgradeLevels[upgradeId] ?? 0) + 1;
    this.state.upgradeLevels[upgradeId] = level;
    for (const effect of upgrade.effects) applyImmediateEffect(effect, this.state);
    this.events.emit('upgradePurchased', { upgradeId, level });
    this.notifyChange();
    return true;
  }

  tick(deltaSeconds: number): void {
    let changed = false;
    for (const producer of this.content.producers) {
      const level = this.state.producerLevels[producer.id] ?? 0;
      if (level <= 0 || !this.isProducerAvailable(producer)) continue;
      const multiplier = getProducerMultiplier(producer, this.content, this.state);
      for (const production of producer.production) {
        this.addResource(production.resourceId, production.amountPerSecond * level * multiplier * deltaSeconds);
        changed = true;
      }
    }
    if (changed) this.notifyChange(false);
    this.checkEvents();
  }

  getProductionPerSecond(resourceId: string): number {
    let total = 0;
    for (const producer of this.content.producers) {
      const level = this.state.producerLevels[producer.id] ?? 0;
      if (level <= 0 || !this.isProducerAvailable(producer)) continue;
      const multiplier = getProducerMultiplier(producer, this.content, this.state);
      for (const production of producer.production) {
        if (production.resourceId === resourceId) total += production.amountPerSecond * level * multiplier;
      }
    }
    return total;
  }

  getProducerMultiplier(producer: ProducerDefinition): number {
    return getProducerMultiplier(producer, this.content, this.state);
  }

  checkEvents(): void {
    for (const event of this.content.events) {
      if (event.once && this.state.completedEvents.includes(event.id)) continue;
      if (this.pendingEventIds.has(event.id)) continue;
      if (evaluateCondition(event.triggerCondition, this.state, this.content)) {
        this.pendingEventIds.add(event.id);
        this.events.emit('eventTriggered', { eventId: event.id });
      }
    }
  }

  chooseEvent(eventId: string, choiceId: string): boolean {
    const event = this.content.events.find((x) => x.id === eventId);
    const choice = event?.choices.find((x) => x.id === choiceId);
    if (!event || !choice) return false;
    if (choice.condition && !evaluateCondition(choice.condition, this.state, this.content)) return false;
    choice.effects.forEach((effect) => applyImmediateEffect(effect, this.state));
    if (event.once && !this.state.completedEvents.includes(event.id)) this.state.completedEvents.push(event.id);
    this.pendingEventIds.delete(event.id);
    this.notifyChange();
    return true;
  }

  findEvent(eventId: string): EventDefinition | undefined {
    return this.content.events.find((x) => x.id === eventId);
  }

  private notifyChange(checkEvents = true): void {
    this.events.emit('stateChanged', undefined);
    if (checkEvents) this.checkEvents();
  }
}
