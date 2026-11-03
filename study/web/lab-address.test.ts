import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labDestination } from './lab-address';
test('portal navigation uses only an explicit laboratory origin and fixed destination', () => {
  assert.equal(labDestination(' https://lab.example:3443/ ', '/study/session'), 'https://lab.example:3443/study/session');
  assert.equal(labDestination('http://localhost:3002', '/lab/assets'), 'http://localhost:3002/lab/assets');
  assert.equal(labDestination('http://[::1]:3002', '/lab/session'), 'http://[::1]:3002/lab/session');
  for (const input of ['javascript:alert(1)', 'http://lab.example', 'https://user:password@lab.example', 'https://lab.example/?key=private', 'https://lab.example/#key', 'https://lab.example/path', 'not-a-url']) assert.throws(() => labDestination(input, '/study/session'));
});
