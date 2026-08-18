import type { ContentBundle, GameState, ProjectSnapshot } from './types';

const STORAGE_KEY = 'knowledge-idle-project-v2';
export const CURRENT_SAVE_VERSION = 2;
export const CURRENT_SNAPSHOT_VERSION = 2;

export function createInitialState(content: ContentBundle): GameState {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    resources: Object.fromEntries(content.resources.map((resource) => [resource.id, resource.initialAmount])),
    producerLevels: Object.fromEntries(content.producers.map((producer) => [producer.id, 0])),
    upgradeLevels: Object.fromEntries(content.upgrades.map((upgrade) => [upgrade.id, 0])),
    completedEvents: [],
    lifetimeClicks: 0,
  };
}

export function normalizeState(state: GameState, content: ContentBundle): GameState {
  const next = structuredClone(state);
  next.saveVersion = CURRENT_SAVE_VERSION;
  for (const resource of content.resources) next.resources[resource.id] ??= resource.initialAmount;
  for (const producer of content.producers) next.producerLevels[producer.id] ??= 0;
  for (const upgrade of content.upgrades) next.upgradeLevels[upgrade.id] ??= 0;
  next.completedEvents ??= [];
  next.lifetimeClicks ??= 0;
  return next;
}

export function saveProject(content: ContentBundle, state: GameState): void {
  const snapshot: ProjectSnapshot = {
    snapshotVersion: CURRENT_SNAPSHOT_VERSION,
    content,
    state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadProject(defaultContent: ContentBundle): ProjectSnapshot | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectSnapshot;
    if (parsed.snapshotVersion !== CURRENT_SNAPSHOT_VERSION) throw new Error('不支持的 snapshotVersion');
    return {
      snapshotVersion: CURRENT_SNAPSHOT_VERSION,
      content: parsed.content,
      state: normalizeState(parsed.state, parsed.content),
    };
  } catch (error) {
    console.error('Save load failed', error);
    return { snapshotVersion: CURRENT_SNAPSHOT_VERSION, content: defaultContent, state: createInitialState(defaultContent) };
  }
}

export function clearProjectSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}
