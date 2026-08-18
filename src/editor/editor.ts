import type { Condition, ContentBundle, ProducerDefinition, ResourceDefinition, UpgradeDefinition } from '../core/types';
import { validateContent } from '../core/contentValidation';

export interface EditorCallbacks {
  getContent(): ContentBundle;
  replaceContent(content: ContentBundle): void;
  onRequestRender(): void;
}

type DraftKind = 'producer' | 'upgrade';

type DraftContext = {
  kind: DraftKind;
  x: number;
  y: number;
  editingId?: string;
};

export function renderEditor(container: HTMLElement, callbacks: EditorCallbacks): void {
  const content = callbacks.getContent();
  const issues = validateContent(content);
  let draft: DraftContext | null = null;

  container.innerHTML = `
    <section class="editor-shell">
      <aside class="editor-palette">
        <div class="palette-heading">
          <span class="eyebrow">NODE PALETTE</span>
          <h2>拖到地图</h2>
          <p>放下后再填写数据，并选择连接到哪个节点。</p>
        </div>
        <div class="palette-items">
          <button class="palette-node producer-tool" draggable="true" data-kind="producer">
            <span class="palette-icon">P</span><div><strong>生产者</strong><small>持续产生资源</small></div>
          </button>
          <button class="palette-node skill-tool" draggable="true" data-kind="upgrade">
            <span class="palette-icon">S</span><div><strong>技能</strong><small>连接生产者或技能</small></div>
          </button>
        </div>
        <div class="palette-section">
          <strong>资源</strong>
          <div class="resource-mini-list">${content.resources.map((r) => `<span>${escapeHtml(r.name)} <code>${escapeHtml(r.id)}</code></span>`).join('')}</div>
          <button id="add-resource" class="secondary wide">+ 新增资源</button>
        </div>
        <div class="palette-section">
          <strong>项目</strong>
          <button id="export-content" class="secondary wide">导出 JSON</button>
          <label class="secondary wide file-label">导入 JSON<input id="import-content" type="file" accept="application/json" hidden></label>
        </div>
        <div class="validation-compact ${issues.some((x) => x.level === 'error') ? 'has-errors' : ''}">
          <strong>${issues.length === 0 ? '数据验证通过' : `${issues.length} 个数据提示`}</strong>
          ${issues.length ? `<small>${escapeHtml(issues[0].message)}${issues.length > 1 ? '…' : ''}</small>` : '<small>节点引用与 ID 当前正常。</small>'}
        </div>
      </aside>

      <section class="editor-workspace">
        <header class="editor-map-toolbar">
          <div><span class="eyebrow">MAP EDITOR</span><strong>拖动现有节点可重新排布 · 双击可编辑</strong></div>
          <span>${content.producers.length} 生产者 · ${content.upgrades.length} 技能</span>
        </header>
        <div class="editor-viewport" id="editor-viewport">
          <div class="editor-map" id="editor-map">
            ${renderConnections(content)}
            ${renderEditorNodes(content)}
            <div class="drop-hint">把左侧节点拖到这里</div>
          </div>
        </div>
      </section>
    </section>
    <div id="editor-modal-root"></div>
  `;

  const editorMap = container.querySelector<HTMLElement>('#editor-map')!;

  container.querySelectorAll<HTMLElement>('.palette-node').forEach((tool) => {
    tool.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/knowledge-node-kind', tool.dataset.kind!);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    });
  });

  editorMap.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  editorMap.addEventListener('drop', (event) => {
    event.preventDefault();
    const kind = event.dataTransfer?.getData('text/knowledge-node-kind') as DraftKind;
    if (kind !== 'producer' && kind !== 'upgrade') return;
    const rect = editorMap.getBoundingClientRect();
    draft = { kind, x: clamp(event.clientX - rect.left, 40, 2260), y: clamp(event.clientY - rect.top, 40, 1360) };
    openNodeModal(draft, callbacks, container, () => { draft = null; });
  });

  bindExistingNodeDragging(container, callbacks);

  container.querySelectorAll<HTMLElement>('.editor-node').forEach((node) => {
    node.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      const id = node.dataset.id!;
      const kind = node.dataset.kind as DraftKind;
      const item = kind === 'producer' ? content.producers.find((x) => x.id === id) : content.upgrades.find((x) => x.id === id);
      if (!item) return;
      draft = { kind, x: item.graph?.x ?? 600, y: item.graph?.y ?? 500, editingId: id };
      openNodeModal(draft, callbacks, container, () => { draft = null; });
    });
  });

  container.querySelector<HTMLButtonElement>('#add-resource')!.addEventListener('click', () => {
    const name = prompt('资源名称，例如：创造力');
    if (!name) return;
    const suggested = `resource.${slugify(name) || Date.now()}`;
    const id = prompt('永久 ID', suggested);
    if (!id) return;
    const next = structuredClone(callbacks.getContent());
    const resource: ResourceDefinition = { id: id.trim(), name: name.trim(), tags: [], initialAmount: 0, visible: true };
    next.resources.push(resource);
    callbacks.replaceContent(next);
  });

  container.querySelector<HTMLButtonElement>('#export-content')!.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(callbacks.getContent(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'knowledge-map-content.json';
    anchor.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector<HTMLInputElement>('#import-content')!.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ContentBundle;
      callbacks.replaceContent(parsed);
    } catch {
      alert('无法读取 JSON，请检查格式。');
    }
  });
}

function renderConnections(content: ContentBundle): string {
  const all = [...content.producers.map((item) => ({ id: item.id, item, kind: 'producer' as const })), ...content.upgrades.map((item) => ({ id: item.id, item, kind: 'upgrade' as const }))];
  const map = new Map(all.map((entry, index) => [entry.id, { ...entry, p: entry.item.graph ?? fallbackPlacement(index) }]));
  const paths = all.map((entry, index) => {
    const p = entry.item.graph ?? fallbackPlacement(index);
    if (!p.parentId) return '';
    const parent = map.get(p.parentId);
    if (!parent) return '';
    const a = nodeCenter(parent.p, parent.kind);
    const b = nodeCenter(p, entry.kind);
    return `<path d="M ${a.x} ${a.y} C ${a.x + (b.x-a.x)*.45} ${a.y}, ${b.x - (b.x-a.x)*.45} ${b.y}, ${b.x} ${b.y}" />`;
  }).join('');
  return `<svg class="connection-layer editor-lines" viewBox="0 0 2400 1500" preserveAspectRatio="none">${paths}</svg>`;
}

function renderEditorNodes(content: ContentBundle): string {
  const entries = [
    ...content.producers.map((item) => ({ kind: 'producer' as const, item })),
    ...content.upgrades.map((item) => ({ kind: 'upgrade' as const, item })),
  ];
  return entries.map((entry, index) => {
    const p = entry.item.graph ?? fallbackPlacement(index);
    const image = entry.item.image || '/assets/placeholder.svg';
    return `
      <button class="editor-node ${entry.kind === 'producer' ? 'producer-node' : 'skill-node'}" data-id="${escapeAttribute(entry.item.id)}" data-kind="${entry.kind}" style="left:${p.x}px;top:${p.y}px" draggable="false">
        <span class="node-ring"><img src="${escapeAttribute(image)}" alt=""></span>
        <strong>${escapeHtml(entry.item.name)}</strong>
        <small>${entry.kind === 'producer' ? '生产者' : '技能'}</small>
      </button>
    `;
  }).join('');
}

function bindExistingNodeDragging(container: HTMLElement, callbacks: EditorCallbacks): void {
  container.querySelectorAll<HTMLElement>('.editor-node').forEach((node) => {
    let dragging = false;
    let pointerId = -1;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;
    let moved = false;

    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      pointerId = event.pointerId;
      const rect = node.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      node.setPointerCapture(pointerId);
      node.classList.add('dragging');
    });

    node.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < 3 && !moved) return;
      moved = true;
      const map = container.querySelector<HTMLElement>('#editor-map')!;
      const rect = map.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left - offsetX, 20, 2260);
      const y = clamp(event.clientY - rect.top - offsetY, 20, 1360);
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
    });

    const finish = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      node.classList.remove('dragging');
      if (!moved) return;
      const x = parseFloat(node.style.left);
      const y = parseFloat(node.style.top);
      const next = structuredClone(callbacks.getContent());
      const id = node.dataset.id!;
      const kind = node.dataset.kind as DraftKind;
      const item = kind === 'producer' ? next.producers.find((v) => v.id === id) : next.upgrades.find((v) => v.id === id);
      if (item) item.graph = { ...(item.graph ?? { x, y }), x, y };
      callbacks.replaceContent(next);
    };
    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', finish);
  });
}

function openNodeModal(draft: DraftContext, callbacks: EditorCallbacks, container: HTMLElement, onClose: () => void): void {
  const modalRoot = container.querySelector<HTMLElement>('#editor-modal-root')!;
  const content = callbacks.getContent();
  const isProducer = draft.kind === 'producer';
  const existing = draft.editingId
    ? (isProducer ? content.producers.find((x) => x.id === draft.editingId) : content.upgrades.find((x) => x.id === draft.editingId))
    : undefined;
  const allParents = [
    ...content.producers.map((p) => ({ id: p.id, name: p.name, kind: 'producer' })),
    ...content.upgrades.map((u) => ({ id: u.id, name: u.name, kind: 'upgrade' })),
  ].filter((x) => x.id !== draft.editingId);
  const parentId = existing?.graph?.parentId ?? '';
  const unlockDefaults = getUnlockDefaults(existing?.unlockCondition, parentId, content);

  modalRoot.innerHTML = `
    <div class="modal-backdrop editor-modal-backdrop">
      <form class="node-form-modal" id="node-form">
        <div class="node-form-heading">
          <div><span class="eyebrow">${isProducer ? 'PRODUCER NODE' : 'SKILL NODE'}</span><h2>${draft.editingId ? '编辑节点' : '创建节点'}</h2></div>
          <button type="button" class="inspector-close" id="cancel-node">×</button>
        </div>
        <div class="node-form-grid">
          <label>永久 ID<input name="id" required value="${escapeAttribute(existing?.id ?? `${isProducer ? 'producer' : 'upgrade'}.${Date.now()}`)}" ${draft.editingId ? 'readonly' : ''}></label>
          <label>名称<input name="name" required value="${escapeAttribute(existing?.name ?? '')}" placeholder="例如：微积分"></label>
          <label>分类<input name="category" value="${escapeAttribute(existing?.category ?? '')}" placeholder="例如：数学"></label>
          <label>标签<input name="tags" value="${escapeAttribute(existing?.tags.join(',') ?? '')}" placeholder="math,science"></label>
          <label class="span-2">描述<textarea name="description" placeholder="这个节点做什么？">${escapeHtml(existing?.description ?? '')}</textarea></label>
          <label>图片 URL<input name="image" value="${escapeAttribute(existing?.image ?? '/assets/placeholder.svg')}"></label>
          <label>上传图片<input name="imageFile" type="file" accept="image/*"></label>
          <label class="span-2">连接到哪个节点
            <select name="parentId"><option value="">不连接 / 根节点</option>${allParents.map((p) => `<option value="${escapeAttribute(p.id)}" ${p.id === parentId ? 'selected' : ''}>${escapeHtml(p.name)} · ${p.kind === 'producer' ? '生产者' : '技能'}</option>`).join('')}</select>
          </label>
          <label>出现条件
            <select name="unlockMode">
              <option value="always" ${unlockDefaults.mode === 'always' ? 'selected' : ''}>立即出现</option>
              <option value="parent" ${unlockDefaults.mode === 'parent' ? 'selected' : ''}>跟随连接节点</option>
              <option value="resource" ${unlockDefaults.mode === 'resource' ? 'selected' : ''}>资源达到数量</option>
              <option value="tagcount" ${unlockDefaults.mode === 'tagcount' ? 'selected' : ''}>掌握某标签技能数量</option>
            </select>
          </label>
          <label>父生产者所需等级<input name="parentLevel" type="number" min="1" value="${unlockDefaults.parentLevel}"></label>
          <label>解锁资源<select name="unlockResource">${resourceOptions(content, unlockDefaults.resourceId)}</select></label>
          <label>解锁数量<input name="unlockAmount" type="number" min="0" step="0.01" value="${unlockDefaults.amount}"></label>
          <label>技能标签<input name="unlockTag" value="${escapeAttribute(unlockDefaults.tag)}" placeholder="learning"></label>
          <label>需要掌握技能数<input name="unlockCount" type="number" min="1" step="1" value="${unlockDefaults.count}"></label>
          <label>价格资源<select name="costResource">${resourceOptions(content, firstCostResource(existing, content))}</select></label>
          <label>价格<input name="costAmount" type="number" min="0" step="0.01" value="${firstCostAmount(existing, 10)}"></label>
          ${isProducer ? producerFields(existing as ProducerDefinition | undefined, content) : upgradeFields(existing as UpgradeDefinition | undefined, content)}
        </div>
        <div class="node-form-actions">
          ${draft.editingId ? '<button type="button" id="delete-node" class="danger">删除节点</button>' : '<span></span>'}
          <div><button type="button" class="secondary" id="cancel-node-bottom">取消</button><button type="submit">确定${draft.editingId ? '保存' : '创建'}</button></div>
        </div>
      </form>
    </div>
  `;

  const form = modalRoot.querySelector<HTMLFormElement>('#node-form')!;
  const close = () => { modalRoot.innerHTML = ''; onClose(); };
  modalRoot.querySelector<HTMLButtonElement>('#cancel-node')!.addEventListener('click', close);
  modalRoot.querySelector<HTMLButtonElement>('#cancel-node-bottom')!.addEventListener('click', close);

  modalRoot.querySelector<HTMLButtonElement>('#delete-node')?.addEventListener('click', () => {
    if (!draft.editingId || !confirm('删除这个节点？其他节点的连接可能需要重新设置。')) return;
    const next = structuredClone(callbacks.getContent());
    if (draft.kind === 'producer') next.producers = next.producers.filter((x) => x.id !== draft.editingId);
    else next.upgrades = next.upgrades.filter((x) => x.id !== draft.editingId);
    callbacks.replaceContent(next);
    close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    let image = String(data.get('image') ?? '').trim() || '/assets/placeholder.svg';
    const imageFile = data.get('imageFile');
    if (imageFile instanceof File && imageFile.size > 0) image = await fileToDataUrl(imageFile);
    const id = String(data.get('id')).trim();
    const parent = String(data.get('parentId') ?? '').trim();
    const unlock = buildUnlockCondition(String(data.get('unlockMode')), parent, Number(data.get('parentLevel')), String(data.get('unlockResource')), Number(data.get('unlockAmount')), String(data.get('unlockTag') ?? ''), Number(data.get('unlockCount')), content);
    const graph = { x: draft.x, y: draft.y, ...(parent ? { parentId: parent } : {}) };
    const next = structuredClone(callbacks.getContent());

    if (draft.kind === 'producer') {
      const producer: ProducerDefinition = {
        id,
        name: String(data.get('name')).trim(),
        category: String(data.get('category')).trim() || '未分类',
        description: String(data.get('description') ?? '').trim(),
        image,
        tags: parseTags(String(data.get('tags') ?? '')),
        baseCost: [{ resourceId: String(data.get('costResource')), amount: Number(data.get('costAmount')) || 0 }],
        costScaling: Number(data.get('costScaling')) || 1.15,
        production: [{ resourceId: String(data.get('productionResource')), amountPerSecond: Number(data.get('productionAmount')) || 0 }],
        unlockCondition: unlock,
        graph,
        enabled: true,
      };
      const index = next.producers.findIndex((x) => x.id === (draft.editingId ?? id));
      if (index >= 0) next.producers[index] = producer; else next.producers.push(producer);
    } else {
      const effectMode = String(data.get('effectMode'));
      const multiplier = Number(data.get('multiplier')) || 1.25;
      const effect = effectMode === 'click'
        ? { type: 'click_multiplier' as const, value: multiplier }
        : effectMode === 'tag'
          ? { type: 'producer_multiplier' as const, target: { kind: 'tag' as const, id: String(data.get('targetTag')).trim() }, value: multiplier }
          : { type: 'producer_multiplier' as const, target: { kind: 'producer' as const, id: String(data.get('targetProducer')) }, value: multiplier };
      const upgrade: UpgradeDefinition = {
        id,
        name: String(data.get('name')).trim(),
        category: String(data.get('category')).trim() || '技能',
        description: String(data.get('description') ?? '').trim(),
        image,
        tags: parseTags(String(data.get('tags') ?? '')),
        cost: [{ resourceId: String(data.get('costResource')), amount: Number(data.get('costAmount')) || 0 }],
        unlockCondition: unlock,
        effects: [effect],
        graph,
      };
      const index = next.upgrades.findIndex((x) => x.id === (draft.editingId ?? id));
      if (index >= 0) next.upgrades[index] = upgrade; else next.upgrades.push(upgrade);
    }

    callbacks.replaceContent(next);
    close();
  });
}

function producerFields(existing: ProducerDefinition | undefined, content: ContentBundle): string {
  const prod = existing?.production[0];
  return `
    <label>生产资源<select name="productionResource">${resourceOptions(content, prod?.resourceId ?? content.resources[0]?.id)}</select></label>
    <label>每秒产量<input name="productionAmount" type="number" min="0" step="0.01" value="${prod?.amountPerSecond ?? 1}"></label>
    <label class="span-2">价格成长倍率<input name="costScaling" type="number" min="1" step="0.01" value="${existing?.costScaling ?? 1.15}"></label>
  `;
}

function upgradeFields(existing: UpgradeDefinition | undefined, content: ContentBundle): string {
  const effect = existing?.effects[0];
  const mode = effect?.type === 'click_multiplier' ? 'click' : effect?.type === 'producer_multiplier' && effect.target.kind === 'tag' ? 'tag' : 'producer';
  const multiplier = effect && 'value' in effect ? effect.value : 1.25;
  const targetProducer = effect?.type === 'producer_multiplier' && effect.target.kind === 'producer' ? effect.target.id : content.producers[0]?.id ?? '';
  const targetTag = effect?.type === 'producer_multiplier' && effect.target.kind === 'tag' ? effect.target.id : 'learning';
  return `
    <label>技能效果
      <select name="effectMode">
        <option value="producer" ${mode === 'producer' ? 'selected' : ''}>指定生产者倍率</option>
        <option value="tag" ${mode === 'tag' ? 'selected' : ''}>标签生产者倍率</option>
        <option value="click" ${mode === 'click' ? 'selected' : ''}>地图点击倍率</option>
      </select>
    </label>
    <label>倍率<input name="multiplier" type="number" min="1" step="0.05" value="${multiplier}"></label>
    <label>目标生产者<select name="targetProducer">${content.producers.map((p) => `<option value="${escapeAttribute(p.id)}" ${p.id === targetProducer ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>
    <label>目标标签<input name="targetTag" value="${escapeAttribute(targetTag)}" placeholder="math"></label>
  `;
}

function getUnlockDefaults(condition: Condition | undefined, parentId: string, content: ContentBundle): { mode: 'always' | 'parent' | 'resource' | 'tagcount'; parentLevel: number; resourceId: string; amount: number; tag: string; count: number } {
  const fallbackResource = content.resources[0]?.id ?? '';
  if (!condition || condition.type === 'always') return { mode: parentId ? 'parent' : 'always', parentLevel: 2, resourceId: fallbackResource, amount: 10, tag: 'learning', count: 3 };
  if (condition.type === 'resource_at_least') return { mode: 'resource', parentLevel: 2, resourceId: condition.resourceId, amount: condition.amount, tag: 'learning', count: 3 };
  if (condition.type === 'producer_level_at_least') return { mode: 'parent', parentLevel: condition.level, resourceId: fallbackResource, amount: 10, tag: 'learning', count: 3 };
  if (condition.type === 'upgrade_level_at_least') return { mode: 'parent', parentLevel: 1, resourceId: fallbackResource, amount: 10, tag: 'learning', count: 3 };
  if (condition.type === 'upgrade_tag_count_at_least') return { mode: 'tagcount', parentLevel: 2, resourceId: fallbackResource, amount: 10, tag: condition.tag, count: condition.count };
  return { mode: 'always', parentLevel: 2, resourceId: fallbackResource, amount: 10, tag: 'learning', count: 3 };
}

function buildUnlockCondition(mode: string, parentId: string, parentLevel: number, resourceId: string, amount: number, tag: string, count: number, content: ContentBundle): Condition {
  if (mode === 'resource') return { type: 'resource_at_least', resourceId, amount };
  if (mode === 'tagcount') return { type: 'upgrade_tag_count_at_least', tag: tag.trim(), count: Math.max(1, count || 1) };
  if (mode === 'parent' && parentId) {
    if (content.producers.some((p) => p.id === parentId)) return { type: 'producer_level_at_least', producerId: parentId, level: Math.max(1, parentLevel || 1) };
    if (content.upgrades.some((u) => u.id === parentId)) return { type: 'upgrade_level_at_least', upgradeId: parentId, level: 1 };
  }
  return { type: 'always' };
}

function firstCostResource(existing: ProducerDefinition | UpgradeDefinition | undefined, content: ContentBundle): string {
  if (!existing) return content.resources[0]?.id ?? '';
  return 'baseCost' in existing ? existing.baseCost[0]?.resourceId ?? content.resources[0]?.id ?? '' : existing.cost[0]?.resourceId ?? content.resources[0]?.id ?? '';
}

function firstCostAmount(existing: ProducerDefinition | UpgradeDefinition | undefined, fallback: number): number {
  if (!existing) return fallback;
  return 'baseCost' in existing ? existing.baseCost[0]?.amount ?? fallback : existing.cost[0]?.amount ?? fallback;
}

function resourceOptions(content: ContentBundle, selected?: string): string {
  return content.resources.map((r) => `<option value="${escapeAttribute(r.id)}" ${r.id === selected ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
}

function fallbackPlacement(index: number): { x: number; y: number; parentId?: string } {
  return { x: 460 + (index % 6) * 240, y: 350 + Math.floor(index / 6) * 190 };
}

function nodeCenter(p: { x: number; y: number }, kind: 'producer' | 'upgrade') {
  const size = kind === 'producer' ? 116 : 82;
  return { x: p.x + size / 2, y: p.y + size / 2 };
}

const parseTags = (raw: string) => raw.split(',').map((x) => x.trim()).filter(Boolean);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '.').replace(/^\.+|\.+$/g, '');

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}
function escapeAttribute(value: string): string { return escapeHtml(value); }
