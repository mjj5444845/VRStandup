import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { publicAssetList, verifyPublicAssets } from './asset-preflight';
test('browser asset verification checks every shipped byte and rejects corruption and external paths', async () => {
  const root = 'public/study/club/v1/', manifest = JSON.parse(await fs.readFile(root + 'manifest.json', 'utf8')), previous = globalThis.fetch; let corrupt = false;
  globalThis.fetch = async input => { const pathname = String(input).replace('/study/club/v1/', ''); if (pathname === 'manifest.json') return new Response(JSON.stringify(manifest)); const bytes = await fs.readFile(root + pathname); if (corrupt) bytes[bytes.length - 1] ^= 1; return new Response(bytes); };
  try { let completed = 0; const report = await verifyPublicAssets(done => { completed = done; }); assert.equal(report.files, 26); assert.equal(completed, 26); corrupt = true; await assert.rejects(verifyPublicAssets(), /校验失败/);
    for (const bad of [{}, { ...manifest, files: [] }, { ...manifest, files: manifest.files.map((e: object) => ({ ...e, file: '../private' })) }, { ...manifest, files: Array(26).fill(manifest.files[0]) }]) assert.throws(() => publicAssetList(bad));
  } finally { globalThis.fetch = previous; }
});
