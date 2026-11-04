import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { backupSession } from '../storage/measurements';
import { verifyBackup, restoreBackup } from '../storage/backup';
import { backupCommand } from './backup-cli';
test('verified backup restores into a fresh private session, rejects tampering, traversal and overwrites', async () => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'punchcap-restore-'));
  try {
    const sessions = path.join(root, 'sessions'), source = path.join(sessions, 'S1'); await fs.mkdir(path.join(source, 'nested'), { recursive: true }); await fs.writeFile(path.join(source, 'nested', 'evidence.json'), '{"private":true}');
    const backup = await backupSession(sessions, 'S1', path.join(root, 'backups')), directory = path.join(root, 'backups', backup.id); assert.ok((await verifyBackup(directory)).verified); assert.equal((await backupCommand(['verify', directory])).independentStorageVerified, false);
    const restored = await backupCommand(['restore', directory, path.join(root, 'restored')]); assert.ok(restored.verified); assert.equal(await fs.readFile(path.join(root, 'restored', 'S1', 'nested/evidence.json'), 'utf8'), '{"private":true}');
    await assert.rejects(restoreBackup(directory, path.join(root, 'restored')), /已存在/); await assert.rejects(restoreBackup(directory, path.join(directory, 'nested-root')), /备份内部/);
    await assert.rejects(backupCommand(['restore', directory])); await assert.rejects(backupCommand(['verify', directory, 'extra'])); await assert.rejects(backupCommand(['wrong']));
    await fs.writeFile(path.join(directory, 'extra.json'), 'unlisted'); await assert.rejects(verifyBackup(directory), /不一致/); await fs.unlink(path.join(directory, 'extra.json'));
    await fs.appendFile(path.join(directory, 'nested/evidence.json'), 'tamper'); await assert.rejects(verifyBackup(directory), /校验失败/);
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'backup-manifest.json'), 'utf8')); manifest.files[0].name = '../escape'; await fs.writeFile(path.join(directory, 'backup-manifest.json'), JSON.stringify(manifest)); await assert.rejects(verifyBackup(directory), /路径/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
