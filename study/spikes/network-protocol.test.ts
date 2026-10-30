import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClientMessage, parseServerMessage } from './network-protocol.js';

test('temporary handshake and receipt messages use strict shared shapes', () => {
  const hello = { type: 'hello', data: { role: 'console', protocolVersion: 1 } };
  assert.deepEqual(parseClientMessage(JSON.stringify(hello)), hello);
  assert.deepEqual(parseClientMessage('{"type":"check.send","data":{"id":"test-1"}}'), {
    type: 'check.send', data: { id: 'test-1' },
  });
  assert.equal(parseClientMessage('{"type":"hello","data":{"role":"console","protocolVersion":2}}'), null);
});

test('malformed, oversized, missing, and unexpected fields are rejected', () => {
  for (const raw of [
    'not-json', 'null', '[]', '{}', 'x'.repeat(4097),
    '{"type":"hello","data":{"role":"admin","protocolVersion":1}}',
    '{"type":"hello","data":{"role":"console"}}',
    '{"type":"check.send","data":{"id":""}}',
    '{"type":"check.send","data":{"id":"test-1","extra":true}}',
    '{"type":"check.send","data":{"id":"test-1"},"extra":true}',
  ]) assert.equal(parseClientMessage(raw), null, raw.slice(0, 80));
});

test('browser validates server state and rejects nonboolean peer flags', () => {
  const peers = { type: 'peers', data: { console: true, participant: false } };
  assert.deepEqual(parseServerMessage(JSON.stringify(peers)), peers);
  assert.equal(parseServerMessage('{"type":"peers","data":{"console":"yes","participant":false}}'), null);
  assert.equal(parseServerMessage('{"type":"ready","data":{"role":"other"}}'), null);
});
