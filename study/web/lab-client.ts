import { estimateClock, parseRequest, type Command, type Hello, type Request, type ServerMessage } from '../core/protocol';
import { validateSession, type Session } from '../core/session';
import { object } from '../core/validation';
export function sessionStageLabel(stage: string): string { const labels: Record<string, string> = { created: '场次已创建', ready: '准备完成', 'pre-questionnaire': '前测', practice: '练习', 'round-ready': '等待本轮开始', playing: '主片段播放', responding: '预录回应', 'round-questionnaire': '本轮问卷', break: '轮间休息', 'post-questionnaire': '后测', paused: '已暂停', completed: '已完成', aborted: '已中止' }; return Object.hasOwn(labels, stage) ? labels[stage] : '未知阶段'; }
export type QueueStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
export function createOutbox(storage: QueueStorage, key: string) {
  const raw = storage.getItem(key); let items: Request[] = [];
  if (raw) { try { const value: unknown = JSON.parse(raw); if (!Array.isArray(value)) throw new Error('Not an array'); items = value.map(parseRequest); if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate IDs'); } catch { throw new Error('本机待发记录无效，请保留原始存储并检查，程序没有删除它。'); } }
  if (items.length > 256) throw new Error('本机待发队列超过上限，请先检查。');
  const write = (next: Request[]) => { storage.setItem(key, JSON.stringify(next)); items = next; };
  return { list: () => [...items], add: (item: Request) => { parseRequest(item); if (items.length >= 256) throw new Error('待发队列已满，未丢弃旧记录。'); if (items.some(x => x.id === item.id)) throw new Error('指令编号重复。'); write([...items, item]); }, ack: (id: string) => write(items.filter(item => item.id !== id)) };
}
export type ClientState = { status: 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'; sessions: Session[]; pending: number; message: string; clock: ReturnType<typeof estimateClock> | null; lastReceipt: Extract<ServerMessage, { type: 'receipt' }> | null };
export function stableClientId(storage: QueueStorage, key: string) { const previous = storage.getItem(key); if (previous && /^[A-Za-z0-9-]{1,80}$/.test(previous)) return previous; const value = crypto.randomUUID(); storage.setItem(key, value); return value; }
export function createLabClient(options: { url: string; hello: Hello; storage: QueueStorage; onChange: (state: ClientState) => void; socket?: (url: string) => WebSocket; later?: (run: () => void, ms: number) => ReturnType<typeof setTimeout>; cancel?: (id: ReturnType<typeof setTimeout>) => void }) {
  const box = createOutbox(options.storage, `punchcap-outbox:${options.hello.role}:${options.hello.sessionId ?? 'operator'}:${options.hello.clientId}`), later = options.later ?? setTimeout, cancel = options.cancel ?? clearTimeout;
  let state: ClientState = { status: 'connecting', sessions: [], pending: box.list().length, message: '正在连接实验室服务…', clock: null, lastReceipt: null };
  let socket: WebSocket | undefined, disposed = false, attempt = 0, serial = 0, flight: string | null = null, reconnect: ReturnType<typeof setTimeout> | undefined, clockTimer: ReturnType<typeof setTimeout> | undefined;
  const clockSamples: ReturnType<typeof estimateClock>[] = [];
  const publish = (patch: Partial<ClientState> = {}) => { if (disposed) return; state = { ...state, ...patch, pending: box.list().length }; options.onChange(state); };
  function snapshot(input: unknown) { const s = validateSession(input), old = state.sessions.find(x => x.id === s.id); if (!old || s.version >= old.version) state.sessions = [...state.sessions.filter(x => x.id !== s.id), s]; }
  function flush() { if (state.status !== 'connected' || socket?.readyState !== 1 || flight) return; const first = box.list()[0]; if (first) { flight = first.id; socket.send(JSON.stringify(first)); } }
  function ping() { if (state.status !== 'connected' || socket?.readyState !== 1) return; socket.send(JSON.stringify({ v: 1, type: 'clock', t0: Date.now() })); clockTimer = later(ping, 10000); }
  function connect() {
    if (disposed) return; const generation = ++serial;
    publish({ status: attempt ? 'reconnecting' : 'connecting' }); socket = (options.socket ?? (url => new WebSocket(url)))(options.url); const current = socket;
    current.addEventListener('open', () => { if (!disposed && generation === serial) current.send(JSON.stringify(options.hello)); });
    current.addEventListener('message', event => {
      if (disposed || generation !== serial) return;
      try {
        const m: unknown = JSON.parse(String(event.data)); if (!object(m) || m.v !== 1 || typeof m.type !== 'string') throw new Error('服务端协议版本无效。');
        if (m.type === 'welcome') { if (m.role !== options.hello.role || !Array.isArray(m.sessions)) throw new Error('连接身份与服务端不一致。'); state.sessions = []; m.sessions.forEach(snapshot); attempt = 0; clockSamples.length = 0; publish({ status: 'connected', clock: null, message: '已连接；流程以服务端状态为准。' }); ping(); flush(); }
        else if (m.type === 'snapshot') { snapshot(m.snapshot); publish(); }
        else if (m.type === 'receipt') {
          if (typeof m.id !== 'string' || typeof m.ok !== 'boolean' || (m.error !== undefined && typeof m.error !== 'string') || (m.joinKey !== undefined && (typeof m.joinKey !== 'string' || m.joinKey.length > 200))) throw new Error('回执格式无效。');
          if (m.snapshot) snapshot(m.snapshot); if (m.id === flight) { box.ack(m.id); flight = null; }
          publish({ lastReceipt: m as ServerMessage & { type: 'receipt' }, message: m.ok ? '操作已由服务端保存确认。' : String(m.error ?? '操作被拒绝，请查看最新状态。') }); flush();
        } else if (m.type === 'clock') {
          const sample = estimateClock(m.t0 as number, m.s1 as number, m.s2 as number, Date.now());
          clockSamples.push(sample); if (clockSamples.length > 8) clockSamples.shift(); publish({ clock: clockSamples.reduce((best, item) => item.rttMs < best.rttMs ? item : best) });
        } else if (m.type === 'error') { if (m.retryable === true && m.id === flight) flight = null; publish({ status: 'error', message: String(m.error ?? '服务端拒绝消息') }); }
        else throw new Error('未知服务端消息。');
      } catch (error) { publish({ status: 'error', message: error instanceof Error ? error.message : '消息无法读取' }); }
    });
    current.addEventListener('error', () => { if (!disposed && generation === serial) current.close(); });
    current.addEventListener('close', event => {
      if (disposed || generation !== serial) return; flight = null; if (clockTimer) cancel(clockTimer);
      if (event.code === 1008 || event.code === 4001) { publish({ status: 'closed', message: '连接身份被拒绝或已被替换，请重新配对；待发记录保留。' }); return; }
      publish({ status: 'reconnecting', message: '连接中断，待发记录保留；正在重新连接。' }); reconnect = later(connect, Math.min(10000, 500 * 2 ** Math.min(attempt++, 5)));
    });
  }
  function command(value: Command) {
    const request: Request = { v: 1, type: 'command', id: crypto.randomUUID(), command: value, clientTimeMs: Date.now(), ...(state.clock ? { clock: { offsetMs: state.clock.offsetMs, rttMs: state.clock.rttMs } } : {}) };
    if (new TextEncoder().encode(JSON.stringify(request)).length > 1024 * 1024) throw new Error('配置或指令超过 1 MiB 工程上限。'); box.add(request); publish(); flush(); return request.id;
  }
  function dispose() { disposed = true; serial++; if (reconnect) cancel(reconnect); if (clockTimer) cancel(clockTimer); socket?.close(); }
  connect(); return { command, dispose, retry: () => { if (socket?.readyState === 1) { flight = null; publish({ status: 'connected' }); flush(); } }, state: () => state };
}
