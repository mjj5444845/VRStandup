import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, child, regularFile } from './private-files';
import { validateSession, type Session } from '../core/session';
import { assert, finite, id, object } from '../core/validation';
import type { Receipt } from '../core/protocol';
export type Entry = { seq: number; previous: string; time: number; event: unknown; snapshot: Session; receipt?: { role: 'operator' | 'participant'; clientId: string; requestHash: string; value: Receipt }; hash: string };
export class JournalWriteError extends Error { constructor(cause: unknown) { super('磁盘写入未确认，未确认指令必须保留；请检查磁盘并重启服务后重试。', { cause }); } }
export async function readJournal(root: string, sessionId: string): Promise<Entry[]> {
  const dir = await child(root, sessionId), raw = (await regularFile(path.join(dir, 'events.jsonl'), 256 * 1024 * 1024)).toString('utf8');
  assert(raw.endsWith('\n'), '日志尾部未写完整；已停止恢复，原件没有被截断。');
  const entries: Entry[] = []; let previous = '0'.repeat(64);
  for (const line of raw.trimEnd().split('\n')) {
    const value: unknown = JSON.parse(line);
    assert(object(value) && value.seq === entries.length + 1 && value.previous === previous && finite(value.time) && typeof value.hash === 'string' && object(value.snapshot), '日志编号或结构损坏。');
    const { hash, ...body } = value; assert(sha256(JSON.stringify(body)) === hash, '日志校验链损坏。');
    const snapshot = validateSession(value.snapshot); assert(snapshot.id === sessionId, '日志会话身份不符。');
    if (value.receipt !== undefined) { const r = value.receipt; assert(object(r) && ['operator', 'participant'].includes(String(r.role)) && id(r.clientId) && typeof r.requestHash === 'string' && object(r.value) && id(r.value.id) && typeof r.value.ok === 'boolean', '日志回执无效。'); }
    entries.push(value as Entry); previous = hash;
  }
  return entries;
}
export function createJournal(file: string, prior: Entry[] = []) {
  const entries = [...prior]; let serial = Promise.resolve(), broken = false;
  let bytes = prior.reduce((total, entry) => total + Buffer.byteLength(JSON.stringify(entry) + '\n'), 0);
  async function append(event: unknown, snapshot: Session, receipt?: Entry['receipt']): Promise<Entry> {
    let saved: Entry | undefined;
    const task = serial.then(async () => {
      if (broken) throw new JournalWriteError('Session locked');
      const body = { seq: entries.length + 1, previous: entries.at(-1)?.hash ?? '0'.repeat(64), time: Date.now(), event, snapshot, ...(receipt ? { receipt } : {}) }, entry = { ...body, hash: sha256(JSON.stringify(body)) };
      const line = JSON.stringify(entry) + '\n', length = Buffer.byteLength(line);
      try {
        if (bytes + length > 256 * 1024 * 1024) throw new Error('工程日志上限已达到');
        const handle = await fs.open(file, 'a', 0o600);
        try { await handle.writeFile(line); await handle.sync(); } finally { await handle.close(); }
      } catch (error) { broken = true; throw new JournalWriteError(error); }
      bytes += length;
      entries.push(entry); saved = entry;
    });
    serial = task.catch(() => {}); await task; return saved!;
  }
  return { append, entries: () => [...entries], flush: () => serial };
}
