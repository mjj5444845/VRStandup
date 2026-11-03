import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createJournal, JournalWriteError } from './journal';
import { createSession } from '../core/session';
import { demoPlan } from '../core/demo';
test('a disk open failure cannot acknowledge or mutate journal state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-disk-'));
  try { const journal = createJournal(root), state = createSession('S', 'DEMO1', demoPlan(), 'rehearsal', 1); await assert.rejects(journal.append({ type: 'test' }, state), JournalWriteError); assert.equal(journal.entries().length, 0); await assert.rejects(journal.append({ type: 'retry' }, state), JournalWriteError); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
});
