import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { systemVerifyCommand, verifySystem } from './system-verify';

test('system verification detects stale deployments, missing and corrupted assets, redirects and untrusted origins', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-verify-'));
  const manifest = JSON.parse(await fs.readFile('public/study/club/v1/manifest.json', 'utf8'));
  const bytes = Buffer.from('test-only'), sha256 = createHash('sha256').update(bytes).digest('hex');
  for (const entry of manifest.files) {
    entry.bytes = bytes.length; entry.sha256 = sha256;
    const target = path.join(root, 'public/study/club/v1', entry.file); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes);
  }
  await fs.writeFile(path.join(root, 'public/study/club/v1/manifest.json'), JSON.stringify(manifest));
  const original = globalThis.fetch; let failure = ''; const revision = 'a'.repeat(40);
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.redirect, 'error'); const url = new URL(String(input));
    if (url.pathname.endsWith('build.json')) return Response.json({ revision: failure === 'version' ? 'b'.repeat(40) : revision, dirty: failure === 'dirty' });
    if (url.pathname.endsWith('manifest.json')) return new Response(failure === 'manifest' ? '{}' : JSON.stringify(manifest));
    if (url.pathname.includes('/club/')) return new Response(failure === 'corrupt' ? 'bad-value' : failure === 'oversize' ? 'more-than-allowed' : bytes, { status: failure === 'missing' ? 404 : 200 });
    return new Response(failure === 'html' ? '{}' : '<html>fixture</html>');
  };
  try {
    assert.equal((await systemVerifyCommand([], root)).files.length, 26);
    assert.equal((await verifySystem(root, {url:'https://example.com',revision})).routes.length, 4);
    for (failure of ['version','dirty','manifest','corrupt','oversize','missing','html']) await assert.rejects(verifySystem(root,{url:'https://example.com',revision}));
    failure = '';
    for (const url of ['http://example.com','https://u:p@example.com','https://example.com/private','https://example.com/?token=x']) await assert.rejects(verifySystem(root,{url,revision}));
    await assert.rejects(verifySystem(root,{url:'https://example.com',revision:'bad'})); await assert.rejects(systemVerifyCommand(['--url'],root));
    await fs.writeFile(path.join(root,'public/study/club/v1',manifest.files[0].file),'damaged'); await assert.rejects(verifySystem(root));
  } finally { globalThis.fetch = original; await fs.rm(root, {recursive:true,force:true}); }
});
