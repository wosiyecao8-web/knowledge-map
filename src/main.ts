import './style.css';
import { describeCondition, evaluateCondition } from './core/conditions';
import { GameEngine } from './core/gameEngine';
import { clearProjectSave, createInitialState, loadProject, saveProject } from './core/save';
import type { ProducerDefinition, UpgradeDefinition } from './core/types';
import { defaultContent } from './content/defaultContent';
import { renderEditor } from './editor/editor';
import { formatNumber } from './ui/format';

const saved = loadProject(defaultContent);
const engine = new GameEngine(saved?.content ?? defaultContent, saved?.state);
const app = document.querySelector<HTMLDivElement>('#app')!;
let activeTab: 'play' | 'editor' = 'play';
let eventModalId: string | null = null;
let selectedNodeId: string | null = null;
let lastFrame = performance.now();
let structureDirty = true;
let dynamicDirty = true;
let didCenterMap = false;
let lastVisibleSignature = '';
let lastDynamicUpdate = 0;

engine.events.on('stateChanged', () => { dynamicDirty = true; });
engine.events.on('contentChanged', () => { structureDirty = true; });
engine.events.on('producerPurchased', () => { structureDirty = true; });
engine.events.on('upgradePurchased', () => { structureDirty = true; });
engine.events.on('eventTriggered', ({ eventId }) => {
  if (!eventModalId) eventModalId = eventId;
  structureDirty = true;
});

function lookupName(id: string): string {
  return engine.content.resources.find((x) => x.id === id)?.name
    ?? engine.content.producers.find((x) => x.id === id)?.name
    ?? engine.content.upgrades.find((x) => x.id === id)?.name
    ?? id;
}

function getPlacement(id: string, index: number): { x: number; y: number; parentId?: string } {
  const item = engine.content.producers.find((x) => x.id === id) ?? engine.content.upgrades.find((x) => x.id === id);
  return item?.graph ?? { x: 500 + (index % 5) * 220, y: 400 + Math.floor(index / 5) * 190 };
}

function visibleGraphNodes(): Array<{ id: string; kind: 'producer' | 'upgrade'; item: ProducerDefinition | UpgradeDefinition }> {
  const producers = engine.content.producers
    .filter((producer) => engine.isProducerAvailable(producer) || (engine.state.producerLevels[producer.id] ?? 0) > 0)
    .map((item) => ({ id: item.id, kind: 'producer' as const, item }));
  const upgrades = engine.content.upgrades
    .filter((upgrade) => engine.isUpgradeAvailable(upgrade) || (engine.state.upgradeLevels[upgrade.id] ?? 0) > 0)
    .map((item) => ({ id: item.id, kind: 'upgrade' as const, item }));
  return [...producers, ...upgrades];
}

function render(): void {
  const previousPlayViewport = document.querySelector<HTMLElement>('#knowledge-viewport');
  const previousEditorViewport = document.querySelector<HTMLElement>('#editor-viewport');
  const previousScroll = previousPlayViewport ? { left: previousPlayViewport.scrollLeft, top: previousPlayViewport.scrollTop } : null;
  const previousEditorScroll = previousEditorViewport ? { left: previousEditorViewport.scrollLeft, top: previousEditorViewport.scrollTop } : null;

  if (activeTab === 'editor') {
    app.innerHTML = shell('<main id="editor-root" class="editor-page"></main>');
    bindShell();
    renderEditor(document.querySelector<HTMLElement>('#editor-root')!, {
      getContent: () => engine.content,
      replaceContent: (content) => {
        engine.replaceContent(content);
        saveProject(engine.content, engine.state);
        render();
      },
      onRequestRender: render,
    });
    if (previousEditorScroll) requestAnimationFrame(() => {
      const viewport = document.querySelector<HTMLElement>('#editor-viewport');
      if (viewport) { viewport.scrollLeft = previousEditorScroll.left; viewport.scrollTop = previousEditorScroll.top; }
    });
    return;
  }

  const nodes = visibleGraphNodes();
  lastVisibleSignature = nodes.map((n) => n.id).sort().join('|');
  structureDirty = false;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodeMap = new Map(nodes.map((node, index) => [node.id, { node, placement: getPlacement(node.id, index) }]));
  const selected = selectedNodeId ? nodeMap.get(selectedNodeId)?.node : undefined;
  const resourceHud = engine.content.resources.filter((r) => r.visible !== false).map((resource) => `
    <div class="hud-resource" data-resource-id="${escapeAttribute(resource.id)}">
      <img src="${resource.icon || '/assets/placeholder.svg'}" alt="">
      <span>${escapeHtml(resource.name)}</span>
      <strong class="hud-amount">${formatNumber(engine.state.resources[resource.id] ?? 0)}</strong>
      <small class="hud-rate">+${formatNumber(engine.getProductionPerSecond(resource.id))}/s</small>
    </div>
  `).join('');

  const lines = nodes.map(({ id }, index) => {
    const p = getPlacement(id, index);
    if (!p.parentId || !nodeIds.has(p.parentId)) return '';
    const parent = nodeMap.get(p.parentId);
    if (!parent) return '';
    const a = centerFor(parent.placement, parent.node.kind);
    const b = centerFor(p, nodeMap.get(id)!.node.kind);
    return `<path d="M ${a.x} ${a.y} C ${a.x + (b.x-a.x)*.45} ${a.y}, ${b.x - (b.x-a.x)*.45} ${b.y}, ${b.x} ${b.y}" />`;
  }).join('');

  const nodeHtml = nodes.map(({ id, kind, item }, index) => renderGraphNode(id, kind, item, getPlacement(id, index))).join('');

  app.innerHTML = shell(`
    <main class="game-shell">
      <section class="map-toolbar">
        <div class="map-title"><span class="eyebrow">KNOWLEDGE MAP</span><strong>点击地图空白处学习</strong><small>每次 +${formatNumber(getClickPreview())} 知识 · 新节点满足条件后自动出现</small></div>
        <div class="resource-hud">${resourceHud}</div>
      </section>
      <section class="knowledge-viewport" id="knowledge-viewport">
        <div class="knowledge-map" id="knowledge-map">
          <svg class="connection-layer" viewBox="0 0 2400 1500" preserveAspectRatio="none">${lines}</svg>
          ${nodeHtml}
          <div class="map-origin-hint">知识会从这里慢慢长成一张网</div>
        </div>
      </section>
      <aside class="node-inspector ${selected ? 'open' : ''}" id="node-inspector">
        ${selected ? renderInspector(selected.kind, selected.item) : '<div class="inspector-empty"><strong>选择一个节点</strong><span>点击生产者或技能查看详情。</span></div>'}
      </aside>
      <div id="click-fx-layer"></div>
    </main>
    ${eventModalId ? renderEventModal(eventModalId) : ''}
  `);

  bindShell();
  bindPlay();
  requestAnimationFrame(() => {
    const viewport = document.querySelector<HTMLElement>('#knowledge-viewport');
    if (!viewport) return;
    if (previousScroll) {
      viewport.scrollLeft = previousScroll.left;
      viewport.scrollTop = previousScroll.top;
      return;
    }
    if (!didCenterMap) {
      const first = engine.content.producers[0]?.graph;
      if (first) {
        viewport.scrollLeft = Math.max(0, first.x - viewport.clientWidth / 2 + 60);
        viewport.scrollTop = Math.max(0, first.y - viewport.clientHeight / 2 + 60);
      }
      didCenterMap = true;
    }
  });
}

function centerFor(p: { x: number; y: number }, kind: 'producer' | 'upgrade') {
  const size = kind === 'producer' ? 116 : 82;
  return { x: p.x + size / 2, y: p.y + size / 2 };
}

function renderGraphNode(id: string, kind: 'producer' | 'upgrade', item: ProducerDefinition | UpgradeDefinition, p: { x: number; y: number }): string {
  if (kind === 'producer') {
    const producer = item as ProducerDefinition;
    const level = engine.state.producerLevels[id] ?? 0;
    const cost = engine.producerCost(producer);
    const afford = engine.canAfford(cost);
    return `
      <button class="map-node producer-node ${level > 0 ? 'owned' : 'available'} ${selectedNodeId === id ? 'selected' : ''}" data-node-id="${escapeAttribute(id)}" data-node-kind="producer" style="left:${p.x}px;top:${p.y}px">
        <span class="node-ring"><img src="${escapeAttribute(producer.image || '/assets/placeholder.svg')}" alt=""></span>
        <strong>${escapeHtml(producer.name)}</strong>
        <small class="node-status">${level > 0 ? `Lv.${level}` : afford ? '可购买' : '未购买'}</small>
      </button>
    `;
  }
  const upgrade = item as UpgradeDefinition;
  const level = engine.state.upgradeLevels[id] ?? 0;
  return `
    <button class="map-node skill-node ${level > 0 ? 'owned' : 'available'} ${selectedNodeId === id ? 'selected' : ''}" data-node-id="${escapeAttribute(id)}" data-node-kind="upgrade" style="left:${p.x}px;top:${p.y}px">
      <span class="node-ring"><img src="${escapeAttribute(upgrade.image || '/assets/placeholder.svg')}" alt=""></span>
      <strong>${escapeHtml(upgrade.name)}</strong>
      <small class="node-status">${level > 0 ? '已掌握' : '技能'}</small>
    </button>
  `;
}

function renderInspector(kind: 'producer' | 'upgrade', item: ProducerDefinition | UpgradeDefinition): string {
  if (kind === 'producer') {
    const producer = item as ProducerDefinition;
    const level = engine.state.producerLevels[producer.id] ?? 0;
    const costs = engine.producerCost(producer);
    const affordable = engine.canAfford(costs);
    const multiplier = engine.getProducerMultiplier(producer);
    const production = producer.production.map((p) => `${formatNumber(p.amountPerSecond * Math.max(level, 1) * multiplier)}/秒 ${lookupName(p.resourceId)}`).join(' + ');
    return `
      <button class="inspector-close" id="inspector-close">×</button>
      <img class="inspector-image" src="${producer.image || '/assets/placeholder.svg'}" alt="">
      <span class="node-type-label producer-label">生产者</span>
      <h2>${escapeHtml(producer.name)}</h2>
      <p>${escapeHtml(producer.description ?? '')}</p>
      <dl><div><dt>等级</dt><dd class="inspector-level">Lv.${level}</dd></div><div><dt>产出</dt><dd class="inspector-production">${production}</dd></div><div><dt>倍率</dt><dd class="inspector-multiplier">×${formatNumber(multiplier)}</dd></div></dl>
      <div class="tag-row">${producer.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
      <button class="inspector-action buy-producer" data-id="${producer.id}" ${affordable ? '' : 'disabled'}>升级 · ${costs.map((c) => `${formatNumber(c.amount)} ${lookupName(c.resourceId)}`).join(' + ')}</button>
    `;
  }
  const upgrade = item as UpgradeDefinition;
  const level = engine.state.upgradeLevels[upgrade.id] ?? 0;
  const purchased = level > 0 && !upgrade.repeatable;
  const affordable = engine.canAfford(upgrade.cost);
  return `
    <button class="inspector-close" id="inspector-close">×</button>
    <img class="inspector-image" src="${upgrade.image || '/assets/placeholder.svg'}" alt="">
    <span class="node-type-label skill-label">技能</span>
    <h2>${escapeHtml(upgrade.name)}</h2>
    <p>${escapeHtml(upgrade.description ?? '')}</p>
    <div class="condition-box"><span>出现条件</span><strong>${escapeHtml(describeCondition(upgrade.unlockCondition, lookupName))}</strong></div>
    <div class="tag-row">${upgrade.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
    <button class="inspector-action buy-upgrade" data-id="${upgrade.id}" ${purchased || !affordable ? 'disabled' : ''}>${purchased ? '已掌握' : `学习 · ${upgrade.cost.map((c) => `${formatNumber(c.amount)} ${lookupName(c.resourceId)}`).join(' + ')}`}</button>
  `;
}

function renderEventModal(eventId: string): string {
  const event = engine.findEvent(eventId);
  if (!event) return '';
  return `
    <div class="modal-backdrop">
      <section class="event-modal">
        <img src="${event.image || '/assets/placeholder.svg'}" alt="">
        <p class="eyebrow">SPECIAL EVENT</p>
        <h2>${escapeHtml(event.title)}</h2>
        <p>${escapeHtml(event.description)}</p>
        <div class="event-choices">
          ${event.choices.map((choice) => {
            const allowed = !choice.condition || evaluateCondition(choice.condition, engine.state, engine.content);
            return `<button class="event-choice" data-event="${event.id}" data-choice="${choice.id}" ${allowed ? '' : 'disabled'}>${escapeHtml(choice.text)}</button>`;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}

function shell(content: string): string {
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">K</span><div><strong>Knowledge Map</strong><small>v0.2 node prototype</small></div></div>
      <nav>
        <button data-tab="play" class="tab ${activeTab === 'play' ? 'active' : ''}">游戏地图</button>
        <button data-tab="editor" class="tab ${activeTab === 'editor' ? 'active' : ''}">地图编辑器</button>
      </nav>
      <div class="save-actions"><button id="save-now" class="secondary">保存</button><button id="reset-game" class="secondary">重置进度</button></div>
    </header>
    ${content}
  `;
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab as 'play' | 'editor';
      selectedNodeId = null;
      render();
    });
  });
  app.querySelector<HTMLButtonElement>('#save-now')?.addEventListener('click', () => {
    saveProject(engine.content, engine.state);
    flashButton('save-now', '已保存');
  });
  app.querySelector<HTMLButtonElement>('#reset-game')?.addEventListener('click', () => {
    if (!confirm('重置当前游戏进度？地图内容与编辑器设置会保留。')) return;
    engine.replaceState(createInitialState(engine.content));
    saveProject(engine.content, engine.state);
    selectedNodeId = null;
    render();
  });
}

function bindPlay(): void {
  const map = app.querySelector<HTMLElement>('#knowledge-map');
  map?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.map-node')) return;
    engine.click();
    showClickFx(event as MouseEvent);
  });
  app.querySelectorAll<HTMLButtonElement>('.map-node').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedNodeId = button.dataset.nodeId!;
      render();
    });
  });
  app.querySelector<HTMLButtonElement>('#inspector-close')?.addEventListener('click', () => { selectedNodeId = null; render(); });
  app.querySelectorAll<HTMLButtonElement>('.buy-producer').forEach((button) => {
    button.addEventListener('click', () => engine.purchaseProducer(button.dataset.id!));
  });
  app.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => {
    button.addEventListener('click', () => engine.purchaseUpgrade(button.dataset.id!));
  });
  app.querySelectorAll<HTMLButtonElement>('.event-choice').forEach((button) => {
    button.addEventListener('click', () => {
      if (engine.chooseEvent(button.dataset.event!, button.dataset.choice!)) {
        eventModalId = null;
        render();
      }
    });
  });
}


function computeVisibleSignature(): string {
  return visibleGraphNodes().map((n) => n.id).sort().join('|');
}

function updateDynamicUI(): void {
  app.querySelectorAll<HTMLElement>('.hud-resource').forEach((card) => {
    const id = card.dataset.resourceId;
    if (!id) return;
    const amount = card.querySelector<HTMLElement>('.hud-amount');
    const rate = card.querySelector<HTMLElement>('.hud-rate');
    if (amount) amount.textContent = formatNumber(engine.state.resources[id] ?? 0);
    if (rate) rate.textContent = `+${formatNumber(engine.getProductionPerSecond(id))}/s`;
  });

  app.querySelectorAll<HTMLElement>('.map-node').forEach((node) => {
    const id = node.dataset.nodeId!;
    const status = node.querySelector<HTMLElement>('.node-status');
    if (!status) return;
    if (node.dataset.nodeKind === 'producer') {
      const producer = engine.content.producers.find((p) => p.id === id);
      if (!producer) return;
      const level = engine.state.producerLevels[id] ?? 0;
      status.textContent = level > 0 ? `Lv.${level}` : engine.canAfford(engine.producerCost(producer)) ? '可购买' : '未购买';
      node.classList.toggle('owned', level > 0);
    } else {
      const level = engine.state.upgradeLevels[id] ?? 0;
      status.textContent = level > 0 ? '已掌握' : '技能';
      node.classList.toggle('owned', level > 0);
    }
  });

  if (selectedNodeId) {
    const inspector = app.querySelector<HTMLElement>('#node-inspector');
    const producer = engine.content.producers.find((p) => p.id === selectedNodeId);
    const upgrade = engine.content.upgrades.find((u) => u.id === selectedNodeId);
    if (inspector && producer) {
      const level = engine.state.producerLevels[producer.id] ?? 0;
      const multiplier = engine.getProducerMultiplier(producer);
      const production = producer.production.map((p) => `${formatNumber(p.amountPerSecond * Math.max(level, 1) * multiplier)}/秒 ${lookupName(p.resourceId)}`).join(' + ');
      const cost = engine.producerCost(producer);
      const action = inspector.querySelector<HTMLButtonElement>('.buy-producer');
      const levelEl = inspector.querySelector<HTMLElement>('.inspector-level');
      const prodEl = inspector.querySelector<HTMLElement>('.inspector-production');
      const multEl = inspector.querySelector<HTMLElement>('.inspector-multiplier');
      if (levelEl) levelEl.textContent = `Lv.${level}`;
      if (prodEl) prodEl.textContent = production;
      if (multEl) multEl.textContent = `×${formatNumber(multiplier)}`;
      if (action) {
        action.disabled = !engine.canAfford(cost);
        action.textContent = `升级 · ${cost.map((c) => `${formatNumber(c.amount)} ${lookupName(c.resourceId)}`).join(' + ')}`;
      }
    } else if (inspector && upgrade) {
      const level = engine.state.upgradeLevels[upgrade.id] ?? 0;
      const action = inspector.querySelector<HTMLButtonElement>('.buy-upgrade');
      if (action && level <= 0) action.disabled = !engine.canAfford(upgrade.cost);
    }
  }
}

function showClickFx(event: MouseEvent): void {
  const layer = document.querySelector<HTMLElement>('#click-fx-layer');
  if (!layer) return;
  const fx = document.createElement('span');
  fx.className = 'click-fx';
  fx.textContent = `+${formatNumber(getClickPreview())} 知识`;
  fx.style.left = `${event.clientX}px`;
  fx.style.top = `${event.clientY}px`;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), 700);
}

function getClickPreview(): number {
  let mult = 1;
  for (const upgrade of engine.content.upgrades) {
    const level = engine.state.upgradeLevels[upgrade.id] ?? 0;
    if (!level) continue;
    for (const effect of upgrade.effects) if (effect.type === 'click_multiplier') mult *= Math.pow(effect.value, level);
  }
  return mult;
}

function flashButton(id: string, text: string): void {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) return;
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => { if (button) button.textContent = original; }, 700);
}

function frame(now: number): void {
  const delta = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  engine.tick(delta);

  if (activeTab === 'play' && dynamicDirty && now - lastDynamicUpdate > 120) {
    dynamicDirty = false;
    lastDynamicUpdate = now;
    const signature = computeVisibleSignature();
    if (structureDirty || signature !== lastVisibleSignature) {
      structureDirty = false;
      lastVisibleSignature = signature;
      render();
    } else {
      updateDynamicUI();
    }
  } else if (activeTab === 'editor' && structureDirty) {
    structureDirty = false;
    render();
  }
  requestAnimationFrame(frame);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}
function escapeAttribute(value: string): string { return escapeHtml(value); }

window.addEventListener('beforeunload', () => saveProject(engine.content, engine.state));
setInterval(() => saveProject(engine.content, engine.state), 5000);
Object.assign(window, { game: engine, clearKnowledgeIdleSave: clearProjectSave });
render();
requestAnimationFrame(frame);
