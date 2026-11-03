import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLabClient, createOutbox, stableClientId } from './lab-client';
import type { Request } from '../core/protocol';
function storage() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
test('outbox persists exact requests and quota failure cannot silently discard records', () => {
  const store = storage(), q = createOutbox(store, 'q'); const r: Request = { v: 1, type: 'command', id: 'one', clientTimeMs: 0, command: { kind: 'note', sessionId: 's', expectedVersion: 0, value: 'pending' } };
  q.add(r); assert.deepEqual(createOutbox(store, 'q').list(), [r]); assert.throws(() => q.add(r)); q.ack('other'); assert.equal(q.list().length, 1); q.ack('one'); assert.equal(q.list().length, 0);
  const failing = createOutbox({ ...store, setItem: () => { throw new Error('quota'); } }, 'other'); assert.throws(() => failing.add(r)); assert.equal(failing.list().length, 0);
  assert.equal(stableClientId(store, 'identity'), stableClientId(store, 'identity'));
  store.setItem('corrupt', JSON.stringify([r, r])); assert.throws(() => createOutbox(store, 'corrupt'), /没有删除/); assert.ok(store.getItem('corrupt'));
});
class FakeSocket extends EventTarget {
  readyState = 0; sent: string[] = [];
  send(data: string) { this.sent.push(data); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  close() { this.readyState = 3; const event = new Event('close'); Object.defineProperty(event, 'code', { value: 1006 }); this.dispatchEvent(event); }
}
test('browser client reconnects and resends the same id until a durable receipt arrives', () => {
  const sockets: FakeSocket[] = [], timers = new Map<number, () => void>(); let timer = 0;
  const client = createLabClient({ url: 'ws://local/lab-ws', hello: { v: 1, type: 'hello', role: 'operator', clientId: 'client', key: 'test' }, storage: storage(), onChange: () => {},
    socket: () => { const s = new FakeSocket(); sockets.push(s); return s as unknown as WebSocket; }, later: run => { timers.set(++timer, run); return timer as unknown as ReturnType<typeof setTimeout>; }, cancel: id => { timers.delete(id as unknown as number); } });
  const id = client.command({ kind: 'note', sessionId: 's', expectedVersion: 0, value: 'offline' }); assert.equal(client.state().pending, 1);
  sockets[0].open(); sockets[0].message({ v: 1, type: 'welcome', role: 'operator', sessions: [] });
  const sent = sockets[0].sent.find(s => JSON.parse(s).type === 'command'); assert.ok(sent); sockets[0].close();
  const reconnect = [...timers.values()].at(-1)!; reconnect(); sockets[1].open(); sockets[1].message({ v: 1, type: 'welcome', role: 'operator', sessions: [] });
  assert.equal(sockets[1].sent.find(s => JSON.parse(s).type === 'command'), sent);
  sockets[1].message({ v: 1, type: 'receipt', id, ok: true }); assert.equal(client.state().pending, 0); client.dispose();
});
test('an unconfirmed disk write preserves the outbox until explicit retry', () => {
  const socket = new FakeSocket(); const client = createLabClient({ url: 'ws://local', hello: { v: 1, type: 'hello', role: 'operator', clientId: 'c', key: 'test' }, storage: storage(), onChange: () => {}, socket: () => socket as unknown as WebSocket });
  socket.open(); socket.message({ v: 1, type: 'welcome', role: 'operator', sessions: [] });
  const id = client.command({ kind: 'note', sessionId: 's', expectedVersion: 0, value: 'keep' }); socket.message({ v: 1, type: 'error', id, retryable: true, error: 'disk' });
  assert.equal(client.state().pending, 1); client.retry(); assert.equal(socket.sent.filter(s => JSON.parse(s).type === 'command').length, 2);
  socket.message({ v: 1, type: 'receipt', id, ok: true }); assert.equal(client.state().pending, 0); client.dispose();
});
