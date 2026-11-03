import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pcmWave } from '../core/recording';
import { saveMeasurement, readMeasurement, listMeasurements, backupSession } from './measurements';
test('private measurement audio is immutable, hash-checked and included in verified local backups', async () => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'punchcap-measurements-')), data = path.join(root, 'sessions'), sid = 'test-session', wave = pcmWave(new Float32Array(800), 8000);
  const meta = { schema: 'punchcap-measurement-audio-v1', id: 'segment', sessionId: sid, participantId: 'P1', round: 0, clipId: 'main', mime: 'audio/wav', source: 'synthetic-test', startedAt: '2026-11-03T00:00:00Z', stoppedAt: '2026-11-03T00:00:01Z', reason: 'test', markers: [{ elapsedMs: 0, context: { round: 0, clipId: 'main', phase: 'main', response: 0 }, mediaMs: 0 }] };
  try {
    await fs.mkdir(path.join(data, sid), { recursive: true }); assert.deepEqual(await listMeasurements(data, sid), []);
    const saved = await saveMeasurement(data, meta, wave); assert.deepEqual(await saveMeasurement(data, meta, wave), saved); assert.equal((await readMeasurement(data, sid, 'segment')).bytes.length, wave.length);
    await assert.rejects(saveMeasurement(data, { ...meta, reason: 'changed' }, wave), /不一致/); await assert.rejects(saveMeasurement(data, { ...meta, id: 'invalid' }, new Uint8Array(20)), /容器/);
    const backup = await backupSession(data, sid, path.join(root, 'backup')); assert.ok(backup.verified); assert.equal(backup.independentStorageVerified, false);
    await assert.rejects(backupSession(data, sid, path.join(data, sid, 'nested')), /源会话/);
    await fs.appendFile(path.join(data, sid, 'measurement-audio', 'segment', 'audio.bin'), 'corrupt'); await assert.rejects(readMeasurement(data, sid, 'segment'), /校验/);
    assert.equal((await fs.readFile(path.join(root, 'backup', backup.id, 'measurement-audio/segment/audio.bin'))).length, wave.length);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
