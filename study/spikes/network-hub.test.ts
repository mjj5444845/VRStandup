import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { createNetworkHub } from './network-hub.js';
import { parseServerMessage, type ServerMessage } from './network-protocol.js';

test('same-port handshake, receipt, rejection, disconnect, and reconnection', { timeout: 15000 }, async (t) => {
  const hub = createNetworkHub(false);
  const server = createServer((_req, res) => res.end('page ok'));
  server.on('upgrade', (req, socket, head) => hub.handleUpgrade(req, socket, head));
  const clients: WebSocket[] = [];
  t.after(async () => {
    clients.forEach((socket) => socket.terminate());
    await hub.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  assert.equal(await (await fetch(origin)).text(), 'page ok');

  // Store early messages so assertions do not depend on event scheduling order.
  async function connect() {
    const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/lab-ws`, { origin });
    clients.push(socket);
    const queue: ServerMessage[] = [];
    socket.on('message', (data) => {
      const message = parseServerMessage(data.toString());
      assert.ok(message);
      queue.push(message);
    });
    await once(socket, 'open');
    async function next(type: ServerMessage['type']) {
      for (;;) {
        const index = queue.findIndex((message) => message.type === type);
        if (index >= 0) return queue.splice(index, 1)[0];
        await once(socket, 'message');
      }
    }
    return { socket, next, send: (value: unknown) => socket.send(JSON.stringify(value)) };
  }
  const lab = await connect();
  lab.send({ type: 'hello', data: { role: 'console', protocolVersion: 1 } });
  await lab.next('ready');
  const participant = await connect();
  participant.send({ type: 'hello', data: { role: 'participant', protocolVersion: 1 } });
  await participant.next('ready');
  assert.deepEqual((await participant.next('peers')).data, { console: true, participant: true });
  lab.send({ type: 'check.send', data: { id: 'test-1' } });
  assert.deepEqual((await participant.next('check.command')).data, { id: 'test-1' });
  participant.send({ type: 'check.received', data: { id: 'wrong-id' } });
  assert.match(JSON.stringify(await participant.next('error')), /不匹配/);
  participant.send({ type: 'check.received', data: { id: 'test-1' } });
  assert.deepEqual((await lab.next('check.received')).data, { id: 'test-1' });

  participant.send({ type: 'check.send', data: { id: 'forbidden' } });
  assert.match(JSON.stringify(await participant.next('error')), /角色/);
  const duplicate = await connect();
  const duplicateClosed = once(duplicate.socket, 'close');
  duplicate.send({ type: 'hello', data: { role: 'console', protocolVersion: 1 } });
  assert.match(JSON.stringify(await duplicate.next('error')), /已有页面/);
  await duplicateClosed;
  // Rejected duplicates cannot evict the existing console.
  lab.send({ type: 'check.send', data: { id: 'test-2' } });
  await participant.next('check.command');
  const closed = once(participant.socket, 'close');
  participant.socket.close();
  await closed;
  assert.match(JSON.stringify(await lab.next('error')), /中断/);
  const replacement = await connect();
  replacement.send({ type: 'hello', data: { role: 'participant', protocolVersion: 1 } });
  await replacement.next('ready');
  lab.send({ type: 'check.send', data: { id: 'test-3' } });
  await replacement.next('check.command');
  replacement.send({ type: 'check.received', data: { id: 'test-3' } });
  assert.deepEqual((await lab.next('check.received')).data, { id: 'test-3' });

  const unregistered = await connect();
  unregistered.send({ type: 'check.send', data: { id: 'no-hello' } });
  assert.match(JSON.stringify(await unregistered.next('error')), /声明/);
  const invalid = await connect();
  invalid.socket.send('broken json');
  assert.match(JSON.stringify(await invalid.next('error')), /格式/);

  const foreign = new WebSocket(`${origin.replace('http:', 'ws:')}/lab-ws`, { origin: 'http://other.example' });
  clients.push(foreign);
  const error = await new Promise<Error>((resolve) => foreign.once('error', resolve));
  assert.match(error.message, /403/);
});
