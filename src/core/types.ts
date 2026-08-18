export type Id = string;

export interface ResourceDefinition {
  id: Id;
  name: string;
  description?: string;
  icon?: string;
  tags: string[];
  initialAmount: number;
  visible?: boolean;
}

export interface CostEntry {
  resourceId: Id;
  amount: number;
}

export interface ProductionEntry {
  resourceId: Id;
  amountPerSecond: number;
}

export type Condition =
  | { type: 'always' }
  | { type: 'resource_at_least'; resourceId: Id; amount: number }
  | { type: 'producer_level_at_least'; producerId: Id; level: number }
  | { type: 'upgrade_level_at_least'; upgradeId: Id; level: number }
  | { type: 'upgrade_tag_count_at_least'; tag: string; count: number }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition };

export type EffectTarget =
  | { kind: 'producer'; id: Id }
  | { kind: 'tag'; id: string };

export type Effect =
  | { type: 'producer_multiplier'; target: EffectTarget; value: number }
  | { type: 'resource_add'; resourceId: Id; amount: number }
  | { type: 'click_multiplier'; value: number };

export interface GraphPlacement {
  /** Absolute position on the knowledge map. */
  x: number;
  y: number;
  /** Visual parent. This is deliberately separate from unlockCondition. */
  parentId?: Id;
}

export interface ProducerDefinition {
  id: Id;
  name: string;
  description?: string;
  image?: string;
  category: string;
  tags: string[];
  baseCost: CostEntry[];
  costScaling: number;
  production: ProductionEntry[];
  unlockCondition: Condition;
  graph?: GraphPlacement;
  enabled?: boolean;
}

export interface UpgradeDefinition {
  id: Id;
  name: string;
  description?: string;
  image?: string;
  category: string;
  tags: string[];
  cost: CostEntry[];
  unlockCondition: Condition;
  effects: Effect[];
  graph?: GraphPlacement;
  repeatable?: boolean;
  maxLevel?: number;
}

export interface EventChoice {
  id: Id;
  text: string;
  condition?: Condition;
  effects: Effect[];
}

export interface EventDefinition {
  id: Id;
  title: string;
  description: string;
  image?: string;
  triggerCondition: Condition;
  once: boolean;
  choices: EventChoice[];
}

export interface ContentBundle {
  resources: ResourceDefinition[];
  producers: ProducerDefinition[];
  upgrades: UpgradeDefinition[];
  events: EventDefinition[];
}

export interface GameState {
  saveVersion: number;
  resources: Record<Id, number>;
  producerLevels: Record<Id, number>;
  upgradeLevels: Record<Id, number>;
  completedEvents: Id[];
  lifetimeClicks: number;
}

export interface ProjectSnapshot {
  snapshotVersion: number;
  content: ContentBundle;
  state: GameState;
}
