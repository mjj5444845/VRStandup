import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { applyAction, connectionChanged, createSession, type Session } from '../core/session';
import { MAX_MESSAGE_BYTES, parseHello, parseRequest, type Hello, type Receipt, type Request, type ServerMessage } from '../core/protocol';
import { readBundle } from '../storage/assets';
import { atomicJson, child, newDirectory, privateRoot, regularFile, sha256 } from '../storage/private-files';
import { createJournal, JournalWriteError, readJournal, type Entry } from '../storage/journal';
import { assert, canonicalJson, id, object } from '../core/validation';
type Credentials = { participantHash: string; participantKey: string; boundClientId: string | null };
type Stored = { state: Session; credentials: Credentials; journal: ReturnType<typeof createJournal>; directory: string; receipts: Map<string, Entry['receipt']> };
function secureEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export async function createLab(options: { dataRoot: string; assetRoot: string; operatorKey: string; allowStudy?: boolean; heartbeatMs?: number; verifyAssets?: boolean }) {
  assert(options.operatorKey.length >= 20, '实验员访问密钥过短。');
  const root = await privateRoot(options.dataRoot), sessions = new Map<string, Stored>();
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    assert(item.isDirectory() && id(item.name), '实验目录包含未知项目，请先检查。');
    const entries = await readJournal(root, item.name), directory = await child(root, item.name), credentials: unknown = JSON.parse((await regularFile(path.join(directory, 'credentials.json'), 10000)).toString('utf8'));
    assert(object(credentials) && typeof credentials.participantHash === 'string' && typeof credentials.participantKey === 'string' && sha256(credentials.participantKey) === credentials.participantHash && (credentials.boundClientId === null || id(credentials.boundClientId)) && entries.length, '会话凭据或日志缺失。');
    const stored: Stored = { state: entries.at(-1)!.snapshot, credentials: credentials as Credentials, journal: createJournal(path.join(directory, 'events.jsonl'), entries), directory, receipts: new Map(entries.filter(e => e.receipt).map(e => [`${e.receipt!.role}:${e.receipt!.clientId}:${e.receipt!.value.id}`, e.receipt])) };
    const recovered = connectionChanged(stored.state, false, Date.now());
    if (recovered !== stored.state) { await stored.journal.append({ type: 'server-restarted' }, recovered); stored.state = recovered; }
    sessions.set(item.name, stored);
  }
  const server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });
  const identities = new Map<WebSocket, Hello>(), live = new Map<string, WebSocket>();
  let serial = Promise.resolve(), closing = false;
  const schedule = (run: () => Promise<void>) => { const task = serial.then(run); serial = task.catch(() => {}); return task; };
  const scoped = (s: Session) => ({ ...s, plan: { ...s.plan, assignments: s.plan.assignments.filter(a => a.participantId === s.participantId) } });
  const send = (socket: WebSocket, message: ServerMessage) => {
    if (identities.get(socket)?.role === 'participant') {
      if (message.type === 'snapshot') message = { ...message, snapshot: scoped(message.snapshot) };
      else if (message.type === 'receipt' && message.snapshot) message = { ...message, snapshot: scoped(message.snapshot) };
      else if (message.type === 'welcome') message = { ...message, sessions: message.sessions.map(scoped) };
    }
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const broadcast = (s: Session) => { for (const [socket, who] of identities) if (who.role === 'operator' || who.sessionId === s.id) send(socket, { v: 1, type: 'snapshot', snapshot: s }); };
  async function commit(stored: Stored, state: Session, event: unknown, receipt?: Entry['receipt']) {
    await stored.journal.append(event, state, receipt); stored.state = state;
    if (receipt) stored.receipts.set(`${receipt.role}:${receipt.clientId}:${receipt.value.id}`, receipt); broadcast(state);
  }
  async function authenticate(socket: WebSocket, hello: Hello) {
    assert(socket.readyState === WebSocket.OPEN && !closing, '连接已关闭或服务正在停止。');
    if (hello.role === 'operator') assert(secureEqual(hello.key, options.operatorKey), '访问密钥错误。');
    else {
      const stored = sessions.get(hello.sessionId!); assert(stored && secureEqual(sha256(hello.key), stored.credentials.participantHash), '场次或配对密钥错误。');
      assert(stored.credentials.boundClientId === null || stored.credentials.boundClientId === hello.clientId, '该场次已绑定另一浏览器；需由实验员解除绑定。');
      const old = live.get(stored.state.id); if (old && old !== socket) { const oldHello = identities.get(old); assert(oldHello?.clientId === hello.clientId, '该场次已有参与者连接。'); identities.delete(old); await commit(stored, connectionChanged(stored.state, false, Date.now()), { type: 'connection-replaced', clientId: hello.clientId }); old.close(4001, 'Replaced by authenticated reconnect'); }
      stored.credentials.boundClientId = hello.clientId; await atomicJson(path.join(stored.directory, 'credentials.json'), stored.credentials);
      if (socket.readyState !== WebSocket.OPEN) return;
      live.set(stored.state.id, socket); await commit(stored, connectionChanged(stored.state, true, Date.now()), { type: 'connected', clientId: hello.clientId });
      if (socket.readyState !== WebSocket.OPEN) { live.delete(stored.state.id); await commit(stored, connectionChanged(stored.state, false, Date.now()), { type: 'connection-lost-during-auth', clientId: hello.clientId }); return; }
    }
    // Never retain or log the raw credential after authentication.
    identities.set(socket, { ...hello, key: '' });
    send(socket, { v: 1, type: 'welcome', role: hello.role, sessions: [...sessions.values()].filter(s => hello.role === 'operator' || s.state.id === hello.sessionId).map(s => s.state) });
  }
  async function request(socket: WebSocket, who: Hello, req: Request) {
    const command = req.command, hash = sha256(canonicalJson(req)), stored = sessions.get(command.sessionId), key = `${who.role}:${who.clientId}:${req.id}`;
    if (who.role === 'participant') assert(who.sessionId === command.sessionId && live.get(command.sessionId) === socket, '不能访问其他场次。');
    const prior = stored?.receipts.get(key);
    if (prior) { assert(prior.requestHash === hash, '相同指令编号不能更改内容。'); send(socket, { ...prior.value, ...(who.role === 'operator' && prior.value.ok && ['create', 'resetParticipant'].includes(command.kind) ? { joinKey: stored!.credentials.participantKey } : {}) }); return; }
    if (command.kind === 'create') {
      assert(who.role === 'operator' && !stored, '当前身份不能创建，或场次编号已经存在。');
      assert(command.mode !== 'study' || options.allowStudy, 'M4 只开放工程预演；正式研究还需要 M5–M9 与集中验收。');
      const state = createSession(command.sessionId, command.participantId, command.plan, command.mode, Date.now());
      if (options.verifyAssets !== false) for (const clip of state.plan.clips) { const b = await readBundle(options.assetRoot, clip.id); assert(canonicalJson(b.manifest) === canonicalJson(clip), `配置与本机素材 ${clip.id} 不一致。`); }
      const joinKey = randomBytes(24).toString('base64url'), credentials: Credentials = { participantHash: sha256(joinKey), participantKey: joinKey, boundClientId: null };
      // Keys live only in private credentials, never in the audit journal or snapshots.
      const receipt: Receipt = { v: 1, type: 'receipt', id: req.id, ok: true, snapshot: state };
      const entryReceipt = { role: who.role, clientId: who.clientId, requestHash: hash, value: receipt };
      const directory = await newDirectory(root, state.id, async stage => { await atomicJson(path.join(stage, 'credentials.json'), credentials); await createJournal(path.join(stage, 'events.jsonl')).append({ type: 'created', clientId: who.clientId, clientTimeMs: req.clientTimeMs, clock: req.clock ?? null }, state, entryReceipt); });
      const entries = await readJournal(root, state.id), item: Stored = { state, credentials, directory, journal: createJournal(path.join(directory, 'events.jsonl'), entries), receipts: new Map([[key, entryReceipt]]) }; sessions.set(state.id, item); broadcast(state); send(socket, { ...receipt, joinKey }); return;
    }
    assert(stored, '场次不存在。');
    let receipt: Receipt, next: Session;
    try { next = applyAction(stored.state, command, who.role, Date.now()); receipt = { v: 1, type: 'receipt', id: req.id, ok: true, snapshot: next }; }
    catch (error) { next = stored.state; receipt = { v: 1, type: 'receipt', id: req.id, ok: false, error: error instanceof Error ? error.message : '操作失败', snapshot: next }; }
    if (receipt.ok && command.kind === 'resetParticipant') {
      const newKey = randomBytes(24).toString('base64url'); stored.credentials = { boundClientId: null, participantHash: sha256(newKey), participantKey: newKey }; await atomicJson(path.join(stored.directory, 'credentials.json'), stored.credentials);
      const old = live.get(stored.state.id); if (old) { identities.delete(old); live.delete(stored.state.id); old.close(4001, 'Pairing reset'); }
      await commit(stored, next, { type: 'command', command, clientId: who.clientId, clientTimeMs: req.clientTimeMs, clock: req.clock ?? null }, { role: who.role, clientId: who.clientId, requestHash: hash, value: receipt }); send(socket, { ...receipt, joinKey: newKey }); return;
    }
    await commit(stored, next, { type: 'command', command, clientId: who.clientId, clientTimeMs: req.clientTimeMs, clock: req.clock ?? null, accepted: receipt.ok }, { role: who.role, clientId: who.clientId, requestHash: hash, value: receipt }); send(socket, receipt);
  }
  server.on('connection', socket => {
    let alive = true; const authDeadline = setTimeout(() => { if (!identities.has(socket)) socket.close(1008, 'Authentication required'); }, 10000);
    socket.on('pong', () => { alive = true; });
    const heartbeat = setInterval(() => { if (socket.readyState !== WebSocket.OPEN) return; if (!alive) { socket.terminate(); return; } alive = false; socket.ping(); }, options.heartbeatMs ?? 10000);
    socket.on('error', () => {});
    socket.on('message', (bytes, binary) => {
      void schedule(async () => {
        if (closing) return;
        try {
          assert(!binary, '只接受 JSON 消息。'); const value: unknown = JSON.parse(bytes.toString());
          const who = identities.get(socket);
          if (!who) { await authenticate(socket, parseHello(value)); clearTimeout(authDeadline); return; }
          if (object(value) && value.v === 1 && value.type === 'clock' && typeof value.t0 === 'number' && Number.isFinite(value.t0)) { const s1 = Date.now(); send(socket, { v: 1, type: 'clock', t0: value.t0, s1, s2: Date.now() }); return; }
          const parsed = parseRequest(value);
          try { await request(socket, who, parsed); }
          catch (error) {
            if (error instanceof JournalWriteError || error instanceof Error && 'code' in error) send(socket, { v: 1, type: 'error', id: parsed.id, retryable: true, error: '本机文件写入未确认，待发指令应保留；请检查磁盘并重启后重试。' });
            else send(socket, { v: 1, type: 'receipt', id: parsed.id, ok: false, error: error instanceof Error ? error.message : '操作被拒绝' });
          }
        } catch (error) { send(socket, { v: 1, type: 'error', error: error instanceof Error ? error.message : '指令被拒绝' }); if (!identities.has(socket)) socket.close(1008, 'Authentication rejected'); }
      });
    });
    socket.on('close', () => {
      clearTimeout(authDeadline); clearInterval(heartbeat); const who = identities.get(socket); identities.delete(socket);
      if (!who || who.role !== 'participant' || live.get(who.sessionId!) !== socket) return; live.delete(who.sessionId!);
      void schedule(async () => { const s = sessions.get(who.sessionId!); if (s) await commit(s, connectionChanged(s.state, false, Date.now()), { type: closing ? 'server-stopping' : 'disconnected', clientId: who.clientId }); }).catch(() => {});
    });
  });
  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const origin = req.headers.origin;
    const protocol = 'encrypted' in req.socket && req.socket.encrypted ? 'https:' : 'http:';
    if (closing || !origin || !req.headers.host || origin !== `${protocol}//${req.headers.host}` || req.url !== '/lab-ws') { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    server.handleUpgrade(req, socket, head, ws => server.emit('connection', ws, req));
  }
  async function close() {
    closing = true; await serial;
    for (const s of sessions.values()) if (s.state.connected) await commit(s, connectionChanged(s.state, false, Date.now()), { type: 'server-stopping' });
    identities.clear(); live.clear(); for (const socket of server.clients) socket.terminate(); await new Promise<void>(resolve => server.close(() => resolve())); await serial;
  }
  return { upgrade, close, sessions: () => [...sessions.values()].map(s => s.state), operatorAuthorized: (key: string) => secureEqual(key, options.operatorKey), participantAuthorized: (sessionId: string, key: string) => { const s = sessions.get(sessionId); return Boolean(s && secureEqual(sha256(key), s.credentials.participantHash)); }, journal: (sessionId: string) => sessions.get(sessionId)?.journal.entries() ?? [] };
}
