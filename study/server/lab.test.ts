import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { startLabServer } from './http';
import { demoPlan } from '../core/demo';
import type { Action } from '../core/session';
import type { Command, Receipt, Request, ServerMessage } from '../core/protocol';
import { readJournal } from '../storage/journal';
import { saveBundle } from '../storage/assets';
import { syntheticTake } from '../core/synthetic-take';
const operatorKey = 'test-only-operator-key-not-a-credential';
async function peer(port: number, hello: Record<string, unknown>) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/lab-ws`, { origin: `http://127.0.0.1:${port}` }), messages: ServerMessage[] = [];
  const waiters: (() => void)[] = []; ws.on('message', bytes => { messages.push(JSON.parse(bytes.toString()) as ServerMessage); waiters.splice(0).forEach(run => run()); }); ws.on('error', () => {});
  function wait(predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Timed out waiting for server event')), 5000); const check = () => { const found = messages.find(predicate); if (found) { clearTimeout(timer); resolve(found); } else waiters.push(check); }; check(); });
  }
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); ws.send(JSON.stringify({ v: 1, type: 'hello', ...hello }));
  return { ws, wait, messages, command: async (req: Request) => { ws.send(JSON.stringify(req)); return await wait(m => m.type === 'receipt' && m.id === req.id) as Receipt; }, close: async () => { if (ws.readyState === WebSocket.CLOSED) return; const closed = new Promise<void>(resolve => ws.once('close', () => resolve())); ws.close(); await closed; } };
}
test('real two-end session: identity, phase order, outage, resume, dedup, clock and crash-safe restore', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-lab-')), data = path.join(root, 'sessions');
  let running = await startLabServer({ port: 0, dataRoot: data, assetRoot: path.join(root, 'assets'), operatorKey, verifyAssets: false });
  const peers: Awaited<ReturnType<typeof peer>>[] = []; let n = 0;
  const connect = async (hello: Record<string, unknown>) => { const p = await peer(running.port, hello); peers.push(p); return p; };
  const make = (command: Command): Request => ({ v: 1, type: 'command', id: `request-${++n}`, clientTimeMs: Date.now(), command });
  try {
    const bad = await connect({ role: 'operator', clientId: 'bad', key: 'wrong' }); await bad.wait(m => m.type === 'error'); await bad.close();
    let op = await connect({ role: 'operator', clientId: 'operator-client', key: operatorKey }); await op.wait(m => m.type === 'welcome');
    const create = make({ kind: 'create', sessionId: 'SESSION1', participantId: 'DEMO1', mode: 'rehearsal', plan: demoPlan() });
    const receipt = await op.command(create); assert.equal(receipt.ok, true); assert.ok(receipt.joinKey); let state = receipt.snapshot!;
    const count = running.lab.journal(state.id).length;
    op.ws.send(JSON.stringify(create)); await new Promise<void>(resolve => op.ws.once('message', () => resolve())); assert.equal(running.lab.journal(state.id).length, count);
    const wrongIdentity = await connect({ role: 'participant', clientId: 'intruder', key: 'wrong', sessionId: state.id }); await wrongIdentity.wait(m => m.type === 'error'); await wrongIdentity.close();
    let p = await connect({ role: 'participant', clientId: 'participant-client', key: receipt.joinKey, sessionId: state.id }); await p.wait(m => m.type === 'welcome');
    const participantWelcome = p.messages.find(m => m.type === 'welcome'); assert.equal(participantWelcome?.type === 'welcome' ? participantWelcome.sessions[0].plan.assignments.length : 0, 1);
    const change = async (kind: Action['kind'], role: 'operator' | 'participant' = 'operator', value?: string | number) => {
      state = running.lab.sessions()[0]; const result = await (role === 'operator' ? op : p).command(make({ kind, sessionId: state.id, expectedVersion: state.version, ...(value === undefined ? {} : { value }) })); assert.equal(result.ok, true, result.error); state = result.snapshot!; return result;
    };
    await change('ready', 'participant'); await change('advance'); await change('advance'); await change('preDone', 'participant'); await change('practiceDone', 'participant'); await change('advance');
    p.ws.send(JSON.stringify({ v: 1, type: 'clock', t0: 100 })); const clock = await p.wait(m => m.type === 'clock'); assert.equal(clock.type, 'clock');
    const version = running.lab.sessions()[0].version; await p.close(); await op.wait(m => m.type === 'snapshot' && m.snapshot.version > version && m.snapshot.stage === 'paused');
    assert.equal(running.lab.sessions()[0].ready, false);
    const impersonator = await connect({ role: 'participant', clientId: 'different-client', key: receipt.joinKey, sessionId: state.id }); await impersonator.wait(m => m.type === 'error'); await impersonator.close();
    p = await connect({ role: 'participant', clientId: 'participant-client', key: receipt.joinKey, sessionId: state.id }); await p.wait(m => m.type === 'welcome'); assert.equal(running.lab.sessions()[0].stage, 'paused');
    await change('ready', 'participant'); await change('resume');
    const stale = await op.command(make({ kind: 'pause', sessionId: state.id, expectedVersion: 0 })); assert.equal(stale.ok, false);
    const note = make({ kind: 'note', sessionId: state.id, expectedVersion: state.version, value: 'queued rehearsal note' }); await p.command(note);
    const before = running.lab.journal(state.id).length; await p.close(); await op.close(); await running.close();
    running = await startLabServer({ port: 0, dataRoot: data, assetRoot: path.join(root, 'assets'), operatorKey, verifyAssets: false });
    assert.equal(running.lab.sessions()[0].stage, 'paused'); assert.equal(running.lab.sessions()[0].connected, false);
    op = await connect({ role: 'operator', clientId: 'operator-client', key: operatorKey }); await op.wait(m => m.type === 'welcome');
    p = await connect({ role: 'participant', clientId: 'participant-client', key: receipt.joinKey, sessionId: state.id }); await p.wait(m => m.type === 'welcome');
    const afterConnect = running.lab.journal(state.id).length; const repeated = await p.command(note); assert.equal(repeated.ok, true); assert.equal(running.lab.journal(state.id).length, afterConnect); assert.ok(afterConnect > before);
    await change('ready', 'participant'); await change('resume'); await change('abort', 'operator', 'end of test'); assert.equal(running.lab.sessions()[0].stage, 'aborted');
    const log = await readJournal(data, state.id); assert.equal(log.at(-1)?.snapshot.stage, 'aborted'); assert.equal(JSON.stringify(log).includes(receipt.joinKey!), false);
    const response = await fetch(`http://127.0.0.1:${running.port}/api/lab/events?session=${state.id}`, { headers: { Authorization: `Bearer ${operatorKey}` } }); assert.equal(response.status, 200);
    const denied = await fetch(`http://127.0.0.1:${running.port}/api/lab/assets`); assert.equal(denied.status, 400);
    const cross = await fetch(`http://127.0.0.1:${running.port}/api/lab/assets`, { headers: { Authorization: `Bearer ${operatorKey}`, Origin: 'https://evil.example' } }); assert.equal(cross.status, 400);
  } finally { for (const p of peers) await p.close(); await running.close(); await fs.rm(root, { recursive: true, force: true }); }
});
test('journal corruption stops recovery without truncating the original', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-journal-')); const running = await startLabServer({ port: 0, dataRoot: root, assetRoot: root, operatorKey, verifyAssets: false });
  const op = await peer(running.port, { role: 'operator', clientId: 'operator', key: operatorKey });
  try {
    await op.wait(m => m.type === 'welcome'); await op.command({ v: 1, type: 'command', id: 'create', clientTimeMs: 0, command: { kind: 'create', sessionId: 'S1', participantId: 'DEMO1', mode: 'rehearsal', plan: demoPlan() } });
    await op.close(); await running.close(); const file = path.join(root, 'S1', 'events.jsonl'); await fs.appendFile(file, '{broken'); const before = await fs.readFile(file);
    await assert.rejects(startLabServer({ port: 0, dataRoot: root, assetRoot: root, operatorKey, verifyAssets: false }), /尾部/); assert.deepEqual(await fs.readFile(file), before);
  } finally { await op.close(); await running.close().catch(() => {}); await fs.rm(root, { recursive: true, force: true }); }
});
test('verified local materials support the complete four-round rehearsal over real sockets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-flow-')), assets = path.join(root, 'assets'), plan = demoPlan();
  for (let i = 0; i < plan.clips.length; i++) { const c = plan.clips[i]; plan.clips[i] = await saveBundle(assets, syntheticTake(c.id), { id: c.id, actorId: c.actorId, kind: c.kind, model: c.model, cues: c.cues, approval: c.approval, sync: c.sync }); }
  const running = await startLabServer({ port: 0, dataRoot: path.join(root, 'sessions'), assetRoot: assets, operatorKey });
  const op = await peer(running.port, { role: 'operator', clientId: 'operator', key: operatorKey }); let participant: Awaited<ReturnType<typeof peer>> | undefined, sequence = 0;
  const request = (command: Command): Request => ({ v: 1, type: 'command', id: `r-${++sequence}`, clientTimeMs: Date.now(), command });
  try {
    await op.wait(m => m.type === 'welcome');
    const invalidPlan = structuredClone(plan); invalidPlan.clips[0].files.audio.sha256 = '0'.repeat(64);
    assert.equal((await op.command(request({ kind: 'create', sessionId: 'BAD', participantId: 'DEMO1', mode: 'rehearsal', plan: invalidPlan }))).ok, false); assert.equal(running.lab.sessions().length, 0);
    const created = await op.command(request({ kind: 'create', sessionId: 'FLOW', participantId: 'DEMO1', mode: 'rehearsal', plan })); assert.ok(created.ok);
    participant = await peer(running.port, { role: 'participant', clientId: 'participant', key: created.joinKey, sessionId: 'FLOW' }); await participant.wait(m => m.type === 'welcome');
    async function act(kind: Action['kind'], role: 'operator' | 'participant' = 'operator', value?: string | number) { const s = running.lab.sessions()[0]; const r = await (role === 'operator' ? op : participant!).command(request({ kind, sessionId: s.id, expectedVersion: s.version, ...(value === undefined ? {} : { value }) })); assert.equal(r.ok, true, r.error); }
    await act('ready', 'participant'); await act('advance'); await act('advance'); await act('preDone', 'participant'); await act('practiceDone', 'participant');
    for (let i = 0; i < 4; i++) {
      await act('advance'); const s = running.lab.sessions()[0], condition = s.plan.assignments[0].rounds[i].condition;
      if (condition === 'D') { await act('progress', 'participant', 2500); await act('respond', 'operator', 'response'); await act('responseDone', 'participant'); assert.equal(running.lab.sessions()[0].positionMs, 2500); }
      await act('roundDone', 'participant'); await act('surveyDone', 'participant'); if (i < 3) await act('advance');
    }
    await act('postDone', 'participant'); assert.equal(running.lab.sessions()[0].stage, 'completed');
    const url = `http://127.0.0.1:${running.port}/api/lab/`;
    assert.equal((await fetch(url + 'rehearsal-plan', { headers: { Authorization: `Bearer ${operatorKey}` } })).status, 200);
    assert.equal((await fetch(url + 'take?clip=../escape', { headers: { Authorization: `Bearer ${operatorKey}` } })).status, 400);
    const log = await readJournal(path.join(root, 'sessions'), 'FLOW'); assert.equal(log.at(-1)?.snapshot.stage, 'completed');
  } finally { await participant?.close(); await op.close(); await running.close(); await fs.rm(root, { recursive: true, force: true }); }
});
