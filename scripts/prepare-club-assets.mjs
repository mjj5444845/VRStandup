import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const source = path.resolve(process.argv[2] ?? 'local_assets/collections/soft-clay-club/v1');
const target = path.resolve('public/study/club/v1');
const collection = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
const ids = ['scene-empty', 'actor', ...Array.from({ length: 5 }, (_, i) => `audience-0${i + 1}`)];
const models = ids.map(id => { const entry = collection.models.find(m => m.id === id); if (!entry || entry.file !== `models/${id}.glb`) throw new Error(`Invalid model entry ${id}`); return entry; });
const graphics = JSON.parse(await fs.readFile(path.join(source, 'graphics/manifest.json'), 'utf8'));
const audio = JSON.parse(await fs.readFile(path.join(source, 'audio/manifest.json'), 'utf8'));
if (graphics.some(g => !/^(expressive|distancing)-[a-z-]+$/.test(g.id)) || audio.some(a => !/^audio\/working\/[a-z-]+\.wav$/.test(a.file))) throw new Error('Invalid asset path');
const files = [...models.map(m => m.file), ...graphics.map(g => `graphics/${g.id}.png`), ...audio.map(a => a.file), 'fonts/NotoSansSC-Variable.ttf', 'fonts/OFL.txt', 'rigs/actor-mapping.json', 'scene-layout.json', 'lighting.json'];
const manifest = { schema: 'punchcap-public-club-v1', version: 'v1', source: 'Soft Clay Club v1 candidate; user authorized runtime integration and upload on 2026-11-03', files: [], graphics, audio };
for (const file of files) {
  const bytes = await fs.readFile(path.join(source, file)), sha256 = createHash('sha256').update(bytes).digest('hex');
  const model = models.find(m => m.file === file); if (model && sha256 !== model.sha256) throw new Error(`Source hash mismatch: ${file}`);
  await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
  await fs.writeFile(path.join(target, file), bytes);
  manifest.files.push({ file, bytes: bytes.length, sha256 });
}
await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${manifest.files.length} allowlisted runtime assets (${manifest.files.reduce((n, f) => n + f.bytes, 0)} bytes). Originals remain local.`);
