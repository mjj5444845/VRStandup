export const STATUS = {
  complete: { label: '已完成', description: '这一项交付已完成；不代表所属阶段或整套系统已验收。' },
  desktop: { label: 'Mac 已验证', description: '已有代码和 Mac 结果；Windows、Quest 3 或正式场景仍需各自验收。' },
  planned: { label: '待开展', description: '已经进入计划，尚未完成这一项的开发或实际检查。' },
  confirm: { label: '待确认', description: '需要先确认研究依据、素材格式或设备能力，才能落实实现。' },
  paused: { label: '已暂缓', description: '按当前安排暂缓，已有进展和未通过项都保留。' },
  reference: { label: '历史参考', description: '旧视频方案的技术积累，不计入当前三维演员主线任务。' },
} as const;
export type TaskStatus = keyof typeof STATUS;
export const KINDS = {
  foundation: '基础准备', spike: '技术验证', feature: '正式功能', art: '模型精修', research: '研究依据', reference: '历史参考',
} as const;
export type TaskKind = keyof typeof KINDS;
export type Stage = { id: string; name: string; title: string; purpose: string };
export type Task = {
  id: string; stage: string; module: string; kind: TaskKind; status: TaskStatus;
  title: string; purpose: string; outcome: string; current: string; acceptance: string;
  dependencies: string[]; route?: string;
};
export type Catalog = { version: 1; updatedAt: string; stages: Stage[]; tasks: Task[] };
export type Filters = { stage: string; status: string; kind: string; query: string };
export const EMPTY_FILTERS: Filters = { stage: 'all', status: 'all', kind: 'all', query: '' };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasStrings(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof value[key] === 'string' && (value[key] as string).trim().length > 0);
}
/** Fail visibly on inconsistent task ownership or dependencies instead of showing misleading totals. */
export function validateCatalog(input: unknown): Catalog {
  if (!object(input) || input.version !== 1 || typeof input.updatedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.updatedAt)
    || !Array.isArray(input.stages) || !Array.isArray(input.tasks)) throw new Error('任务清单格式无效。');
  const stageIds = new Set<string>();
  for (const stage of input.stages) {
    if (!object(stage) || !hasStrings(stage, ['id', 'name', 'title', 'purpose'])
      || stageIds.has(String(stage.id))) throw new Error('阶段内容缺失或编号重复。');
    stageIds.add(String(stage.id));
  }
  const ids = new Set<string>();
  for (const task of input.tasks) {
    if (!object(task) || !hasStrings(task, ['id', 'stage', 'module', 'kind', 'status', 'title', 'purpose', 'outcome', 'current', 'acceptance'])
      || ids.has(String(task.id)) || !stageIds.has(String(task.stage))
      || !Object.hasOwn(STATUS, String(task.status)) || !Object.hasOwn(KINDS, String(task.kind))
      || !Array.isArray(task.dependencies) || !task.dependencies.every((id) => typeof id === 'string')
      || (task.route !== undefined && (typeof task.route !== 'string' || !/^\/(?!\/)/.test(task.route)))) {
      throw new Error('任务编号、归属、说明、状态或入口无效。');
    }
    if ((task.stage === 'REF') !== (task.status === 'reference') || (task.kind === 'reference') !== (task.status === 'reference')) {
      throw new Error('历史参考必须单独归类，不能计为主线完成。');
    }
    ids.add(String(task.id));
  }
  const catalog = input as Catalog;
  const tasks = new Map(catalog.tasks.map((task) => [task.id, task]));
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('任务前置依赖形成循环。');
    if (visited.has(id)) return;
    const task = tasks.get(id);
    if (!task) throw new Error('任务引用了不存在的前置工作。');
    visiting.add(id); task.dependencies.forEach(visit); visiting.delete(id); visited.add(id);
  }
  catalog.tasks.forEach((task) => visit(task.id));
  return catalog;
}

/** Historical prototypes remain browsable but never inflate current-mainline progress. */
export function summarize(tasks: readonly Task[]) {
  const mainline = tasks.filter((task) => task.status !== 'reference');
  const counts = Object.fromEntries(Object.keys(STATUS).map((status) => [status, tasks.filter((task) => task.status === status).length])) as Record<TaskStatus, number>;
  return { total: tasks.length, mainline: mainline.length, ...counts, pending: counts.planned + counts.confirm + counts.paused };
}
export function filterTasks(catalog: Catalog, filters: Filters): Task[] {
  const stages = new Map(catalog.stages.map((stage) => [stage.id, stage]));
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.tasks.filter((task) => {
    if (filters.stage !== 'all' && task.stage !== filters.stage) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.kind !== 'all' && task.kind !== filters.kind) return false;
    const text = [task.id, task.title, task.module, KINDS[task.kind], task.purpose, task.outcome, task.current, task.stage, stages.get(task.stage)?.name].join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
