import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { startLabServer } from './http';
import { prepareEngineering } from '../storage/engineering';
import { restoreBackup } from '../storage/backup';
import { readJournal } from '../storage/journal';
import { saveBundle } from '../storage/assets';
import { syntheticTake } from '../core/synthetic-take';
import { pcmWave } from '../core/recording';
import { mediaContext, type Evidence } from '../core/execution';
import type { Command, Receipt, ServerMessage } from '../core/protocol';
const operatorKey = 'test-only-integrated-operator-key';
async function peer(port: number, hello: object) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/lab-ws`, { origin: `http://127.0.0.1:${port}` }); let seq = 0;
  const messages: ServerMessage[] = [], listeners: (() => void)[] = [];
  socket.on('error', () => {}); socket.on('message', data => { messages.push(JSON.parse(data.toString())); listeners.splice(0).forEach(f => f()); });
  const wait = (predicate: (m: ServerMessage) => boolean) => new Promise<ServerMessage>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Timed out waiting for integrated service')), 5000); const read = () => { const message = messages.find(predicate); if (message) { clearTimeout(timer); resolve(message); } else listeners.push(read); }; read(); });
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }); socket.send(JSON.stringify({ v: 1, type: 'hello', ...hello })); await wait(m => m.type === 'welcome');
  return { socket, send: async (command: Command) => { const id = `message-${++seq}`, request = { v: 1, type: 'command', id, command, clientTimeMs: Date.now() }; socket.send(JSON.stringify(request)); return await wait(m => m.type === 'receipt' && m.id === id) as Receipt; }, close: async () => { const done = new Promise<void>(resolve => socket.once('close', () => resolve())); socket.close(); await done; } };
}
test('complete integrated system uses checked media, protected captures, two responses, audio, audit, backup and recovery', { timeout: 30000 }, async () => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'punchcap-integrated-')), data = path.join(root, 'sessions'), assets = path.join(root, 'assets'), backups = path.join(root, 'backups');
  let running: Awaited<ReturnType<typeof startLabServer>> | undefined, op: Awaited<ReturnType<typeof peer>> | undefined, participant: Awaited<ReturnType<typeof peer>> | undefined;
  try {
    const plan = await prepareEngineering(assets); assert.deepEqual(await prepareEngineering(assets), plan);
    const extra = await saveBundle(assets, syntheticTake('private-extra'), { ...plan.clips[1], id: 'private-extra' }); plan.clips.push(extra);
    running = await startLabServer({ port: 0, dataRoot: data, assetRoot: assets, backupRoot: backups, operatorKey }); const base = `http://127.0.0.1:${running.port}`;
    op = await peer(running.port, { role: 'operator', clientId: 'operator', key: operatorKey });
    const created = await op.send({ kind: 'create', sessionId: 'integrated', participantId: 'DEMO1', mode: 'rehearsal', plan, integrated: true, audioRequired: true }); assert.ok(created.ok);
    participant = await peer(running.port, { role: 'participant', clientId: 'participant', key: created.joinKey, sessionId: 'integrated' });
    let s = running.lab.sessions()[0]; const headers = { Authorization: `Bearer ${created.joinKey}`, 'x-punchcap-session': 'integrated', 'x-punchcap-client': 'participant' }, operatorHeaders = { Authorization: `Bearer ${operatorKey}` };
    const action = async (kind: 'advance' | 'resume' | 'ready' | 'roundDone', person = op!, value?: string) => { const r = await person.send({ kind, value, sessionId: s.id, expectedVersion: s.version }); if (r.snapshot) s = r.snapshot; return r; };
    const capture = async (evidence: Evidence) => { const r = await participant!.send({ kind: 'capture', sessionId: s.id, evidence }); if (r.snapshot) s = r.snapshot; return r; };
    assert.equal((await action('ready', participant)).ok, false); assert.ok((await action('ready', participant, 'microphone-prepared')).ok); await action('advance'); await action('advance');
    const answers = async () => { const timing = s.stage === 'pre-questionnaire' ? 'pre' : s.stage === 'post-questionnaire' ? 'post' : 'round', q = plan.questionnaires.find(q => q.timing === timing)!; assert.ok((await capture({ kind: 'answers', questionnaireId: q.id, version: q.version, round: s.roundIndex, answers: timing === 'round' ? { 'demo-rating': 7 } : { placeholder: 1 } })).ok); };
    const finish = async () => { assert.ok((await capture({ kind: 'media', context: mediaContext(s)!, positionMs: 12000, ended: true })).ok); };
    await answers();
    assert.equal((await fetch(`${base}/api/run/clip?clip=${plan.practiceClipId}`, { headers: { ...headers, 'x-punchcap-client': 'wrong' } })).status, 400);
    const clipResponse = await fetch(`${base}/api/run/clip?clip=${plan.practiceClipId}`, { headers }); assert.equal(clipResponse.status, 200); const clip = await clipResponse.json(); assert.equal(clip.take.id, plan.practiceClipId);
    assert.equal((await fetch(`${base}/api/run/clip?clip=private-extra`, { headers })).status, 400);
    await finish();
    for (let round = 0; round < 4; round++) {
      await action('advance'); const context = mediaContext(s)!;
      assert.equal((await action('roundDone', participant)).ok, false);
      assert.equal((await capture({ kind: 'media', context, positionMs: 500, ended: true })).ok, false);
      assert.ok((await capture({ kind: 'media', context, positionMs: 5000, ended: false })).ok);
      assert.ok((await capture({ kind: 'orientation', context, samples: [{ elapsedMs: round * 1000, mediaMs: 5000, source: 'desktop', head: { position: [0, 1.2, 2], orientation: [0, 0, 0, 1] }, actorHead: [0, 2.06, -3.78] }] })).ok);
      assert.ok((await capture({ kind: 'performance', context, frames: 60, elapsedMs: 1000, refreshHz: null, source: 'desktop' })).ok);
      if (plan.assignments[0].rounds[round].condition === 'D') {
        for (let response = 0; response < 3; response++) {
          assert.ok((await capture({ kind: 'interaction', context, cueId: 'distancing', atMs: 5000, action: 'land', target: 'self', scale: 1, position: [0, .36, -3.78], outcome: 'stage' })).ok);
          if (response < 2) { assert.equal(s.stage, 'responding'); await finish(); assert.equal(s.positionMs, 5000); } else assert.equal(s.stage, 'playing');
        } assert.equal(s.responseCount, 2);
      }
      assert.ok((await capture({ kind: 'interruption', reason: 'automated-pause' })).ok); assert.equal(s.stage, 'paused'); await action('resume');
      const wave = pcmWave(new Float32Array(800), 8000), metadata = { schema: 'punchcap-measurement-audio-v1', id: `recording-${round}`, sessionId: s.id, participantId: s.participantId, round, clipId: context.clipId, mime: 'audio/wav', source: 'synthetic-test', startedAt: '2026-11-03T00:00:00Z', stoppedAt: '2026-11-03T00:00:01Z', reason: 'automated-test', markers: [{ elapsedMs: 0, context, mediaMs: 5000 }] };
      const upload = () => fetch(`${base}/api/run/audio`, { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/wav', 'x-punchcap-metadata': encodeURIComponent(JSON.stringify(metadata)) }, body: wave.slice().buffer as ArrayBuffer }); assert.equal((await upload()).status, 201); assert.equal((await upload()).status, 201);
      await finish(); await answers(); if (round < 3) await action('advance');
    }
    await answers(); assert.equal(s.stage, 'completed');
    const report = await (await fetch(`${base}/api/lab/report?session=integrated`, { headers: operatorHeaders })).json(); assert.equal(report.audit.complete, true); assert.equal(report.audit.audioFiles, 4); assert.equal(report.audit.answerRecords, 6); assert.ok(report.csv.includes('orientation_samples')); assert.ok(!JSON.stringify(report).includes(created.joinKey!));
    assert.equal((await fetch(`${base}/api/run/report`, { headers })).status, 200); assert.equal((await fetch(`${base}/api/run/audio?audio=recording-0`, { headers })).status, 200); assert.equal((await fetch(`${base}/data/sessions/integrated/measurement-audio/recording-0/audio.bin`)).status, 404);
    const backup = await (await fetch(`${base}/api/lab/backup?session=integrated`, { method: 'POST', headers: operatorHeaders })).json(); assert.equal(backup.verified, true); assert.equal(backup.independentStorageVerified, false);
    const original = await readJournal(data, 'integrated'); assert.ok(original.length > 35);
    await participant.close(); participant = undefined; await op.close(); op = undefined; await running.close(); running = undefined;
    const restore = path.join(root, 'restore'); await restoreBackup(path.join(backups, backup.id), restore); assert.equal((await readJournal(restore, 'integrated')).at(-1)!.snapshot.stage, 'completed');
    running = await startLabServer({ port: 0, dataRoot: restore, assetRoot: assets, operatorKey }); assert.equal(running.lab.sessions()[0].stage, 'completed');
    await fs.appendFile(path.join(restore, 'integrated', 'measurement-audio/recording-0/audio.bin'), 'broken');
    assert.equal((await fetch(`http://127.0.0.1:${running.port}/api/lab/report?session=integrated`, { headers: operatorHeaders })).status, 400);
  } finally { await participant?.close(); await op?.close(); await running?.close(); await fs.rm(root, { recursive: true, force: true }); }
});
