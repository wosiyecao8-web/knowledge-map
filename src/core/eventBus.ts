export type GameEventMap = {
  stateChanged: undefined;
  resourceChanged: { resourceId: string; amount: number };
  producerPurchased: { producerId: string; level: number };
  upgradePurchased: { upgradeId: string; level: number };
  eventTriggered: { eventId: string };
  contentChanged: undefined;
  gameSaved: undefined;
  gameLoaded: undefined;
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEventMap, Set<Handler<any>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    const bucket = this.handlers.get(event) ?? new Set();
    bucket.add(handler);
    this.handlers.set(event, bucket);
    return () => bucket.delete(handler);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}
