import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import { EMPTY_FILTERS, filterTasks, summarize, validateCatalog } from './task-model';

async function catalog() { return validateCatalog(JSON.parse(await readFile(new URL('../../docs/project/tasks.json', import.meta.url), 'utf8'))); }

test('catalog ownership, evidence, dependencies and available page routes are valid', async () => {
  const value = await catalog();
  const root = fileURLToPath(new URL('../../', import.meta.url));
  for (const task of value.tasks) {
    if (task.route) assert.ok(existsSync(path.join(root, 'app', task.route, 'page.tsx')), task.route);
  }
  const bad = { ...value, tasks: [{ ...value.tasks[0], dependencies: ['missing-task'] }, ...value.tasks.slice(1)] };
  assert.throws(() => validateCatalog(bad));
  assert.throws(() => validateCatalog({ ...value, tasks: [{ ...value.tasks[0], dependencies: [value.tasks[0].id] }, ...value.tasks.slice(1)] }));
  assert.throws(() => validateCatalog({ ...value, tasks: [{ ...value.tasks[0], stage: 'unknown' }, ...value.tasks.slice(1)] }));
});
test('historical and Mac-only results never count as fully completed mainline tasks', async () => {
  const value = await catalog();
  const selected = [
    { ...value.tasks[0], status: 'complete' as const },
    { ...value.tasks[1], status: 'desktop' as const },
    { ...value.tasks[2], status: 'reference' as const },
    { ...value.tasks[3], status: 'paused' as const },
    { ...value.tasks[4], status: 'automated' as const },
  ];
  const result = summarize(selected);
  assert.equal(result.mainline, 4); assert.equal(result.complete, 1); assert.equal(result.automated, 1);
  assert.equal(result.desktop, 1); assert.equal(result.reference, 1); assert.equal(result.pending, 1);
});
test('search combines task ownership and purpose with stage, status and model filters', async () => {
  const value = await catalog();
  const matches = filterTasks(value, { ...EMPTY_FILTERS, stage: 'M5', kind: 'art', query: '座椅 材质' });
  assert.ok(matches.length > 0);
  assert.ok(matches.every((task) => task.stage === 'M5' && task.kind === 'art'));
  assert.equal(filterTasks(value, { ...EMPTY_FILTERS, stage: 'M5', status: 'complete' }).length, 0);
  assert.equal(filterTasks(value, { ...EMPTY_FILTERS, query: '  no-such-deliverable  ' }).length, 0);
  assert.equal(filterTasks(value, EMPTY_FILTERS).length, value.tasks.length);
});
