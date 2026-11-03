import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedRehearsal } from './assets-cli';
import { validatePlan } from '../core/plan';
import { readBundle } from '../storage/assets';
test('rehearsal seeding creates reproducible private bundles and leaves originals immutable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-seed-'));
  try { const first = validatePlan(await seedRehearsal(root)), second = validatePlan(await seedRehearsal(root)); assert.deepEqual(first, second); for (const clip of first.clips) { const item = await readBundle(root, clip.id); assert.equal(item.manifest.source, 'synthetic'); assert.equal(item.manifest.files.audio.sha256, clip.files.audio.sha256); } }
  finally { await fs.rm(root, { recursive: true, force: true }); }
});
