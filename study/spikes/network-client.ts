import {
  CHECK_SOCKET_PATH, parseServerMessage,
  type CheckRole, type ClientMessage, type PeerState,
} from './network-protocol';

export type NetworkSnapshot = {
  phase: 'disconnected' | 'connecting' | 'connected';
  message: string;
  peers: PeerState;
  awaiting: boolean;
  sent: number;
  received: number;
  events: { number: number; text: string }[];
};
export const INITIAL_NETWORK: NetworkSnapshot = {
  phase: 'disconnected', message: '尚未连接。', peers: { console: false, participant: false },
  awaiting: false, sent: 0, received: 0, events: [],
};

/** Own one browser socket, its timeouts, and bounded diagnostic history. */
export function createNetworkClient(role: CheckRole, onChange: (state: NetworkSnapshot) => void) {
  let state: NetworkSnapshot = { ...INITIAL_NETWORK, peers: { ...INITIAL_NETWORK.peers } };
  let socket: WebSocket | undefined;
  let disposed = false;
  let sequence = 0;
  let pending: { id: string; started: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let failure = '';

  function publish(patch: Partial<NetworkSnapshot>, event?: string) {
    if (disposed) return;
    state = { ...state, ...patch };
    if (event) state.events = [{ number: ++sequence, text: event }, ...state.events].slice(0, 8);
    onChange(state);
  }
  function clearWaiting() {
    clearTimeout(timer);
    pending = undefined;
  }
  function send(message: ClientMessage) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }
  function disconnect() {
    clearWaiting();
    clearTimeout(connectTimer);
    const previous = socket;
    // Invalidate handlers before closing, so late events cannot overwrite a retry.
    socket = undefined;
    previous?.close(1000, 'page disconnected');
    publish({ phase: 'disconnected', message: '已主动断开，可重新连接。', peers: { console: false, participant: false }, awaiting: false }, '已断开连接');
  }
  function connect() {
    if (disposed || socket) return;
    failure = '';
    publish({ phase: 'connecting', message: '正在连接检查服务…' });
    const url = new URL(CHECK_SOCKET_PATH, window.location.href);
    url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const current = new WebSocket(url);
    socket = current;
    const valid = () => !disposed && socket === current;
    connectTimer = setTimeout(() => {
      if (!valid() || state.phase !== 'connecting') return;
      failure = '连接超时，请确认使用了通信检查服务的网址。';
      current.close();
      publish({ message: failure });
    }, 6000);
    current.addEventListener('open', () => {
      if (valid()) send({ type: 'hello', data: { role, protocolVersion: 1 } });
    });
    current.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!valid()) return;
      const message = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
      if (!message) {
        failure = '检查服务发来了无法识别的消息，请刷新页面。';
        current.close(1008, 'invalid server message');
        return;
      }
      if (message.type === 'ready') {
        if (message.data.role !== role) { current.close(1008, 'wrong role'); return; }
        clearTimeout(connectTimer);
        publish({ phase: 'connected', message: '已连接，等待两端就绪。' }, '检查服务已确认当前角色');
      } else if (message.type === 'peers') {
        if (!message.data.participant) clearWaiting();
        const bothReady = message.data.console && message.data.participant;
        publish({
          peers: message.data, awaiting: !!pending,
          message: bothReady ? '两端均已就绪，可以发送测试指令。' : '本页已连接，等待另一端就绪。',
        });
      } else if (message.type === 'check.command' && role === 'participant') {
        const acknowledged = send({ type: 'check.received', data: message.data });
        publish({ received: state.received + 1, message: acknowledged ? '收到测试指令，已自动发出回复。' : '收到指令，但回复发送失败。' }, `收到指令 ${message.data.id.slice(0, 8)}，${acknowledged ? '已回复' : '未能回复'}`);
      } else if (message.type === 'check.received' && pending?.id === message.data.id) {
        const elapsed = Math.round(performance.now() - pending.started);
        clearWaiting();
        publish({ awaiting: false, received: state.received + 1, message: `已收到参与者回复，往返约 ${elapsed} 毫秒。` }, `指令 ${message.data.id.slice(0, 8)} 已确认收到`);
      } else if (message.type === 'error') {
        failure = message.data.message;
        clearWaiting();
        publish({ awaiting: false, message: failure }, failure);
      }
    });
    current.addEventListener('error', () => {
      if (valid()) failure = '无法连接检查服务。请按 06 说明启动，并使用服务窗口显示的网址。';
    });
    current.addEventListener('close', () => {
      if (!valid()) return;
      socket = undefined;
      clearTimeout(connectTimer);
      clearWaiting();
      publish({ phase: 'disconnected', awaiting: false, peers: { console: false, participant: false }, message: failure || '连接已断开；服务恢复后点击“重新连接”。' }, failure || '与检查服务的连接已断开');
    });
  }
  function sendProbe() {
    if (role !== 'console' || state.phase !== 'connected' || !state.peers.participant || pending) return;
    const id = crypto.randomUUID();
    failure = '';
    pending = { id, started: performance.now() };
    if (!send({ type: 'check.send', data: { id } })) { clearWaiting(); return; }
    publish({ awaiting: true, sent: state.sent + 1, message: '已发送，等待参与者回复…' }, `发出测试指令 ${id.slice(0, 8)}`);
    // This is a network timeout, not a study media or caption scheduler.
    timer = setTimeout(() => {
      clearWaiting();
      publish({ awaiting: false, message: '没有收到回复，请检查连接后重试。' }, '测试回复超时');
    }, 6500);
  }
  function dispose() {
    disposed = true;
    disconnect();
  }
  return { connect, disconnect, sendProbe, dispose };
}
