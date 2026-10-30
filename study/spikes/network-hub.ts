import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CHECK_MAX_BYTES, parseClientMessage,
  type CheckRole, type ServerMessage,
} from './network-protocol.js';

/** Owns only S2 sockets; the caller routes Next's hot-reload upgrades separately. */
export function createNetworkHub(secure: boolean) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: CHECK_MAX_BYTES, perMessageDeflate: false });
  const roles = new Map<CheckRole, WebSocket>();
  let pending: { id: string; timer: ReturnType<typeof setTimeout> } | undefined;
  let closing = false;

  function send(socket: WebSocket | undefined, message: ServerMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function error(socket: WebSocket | undefined, message: string) { send(socket, { type: 'error', data: { message } }); }
  function clearPending() {
    if (pending) clearTimeout(pending.timer);
    pending = undefined;
  }
  function peers() {
    const message: ServerMessage = { type: 'peers', data: { console: roles.has('console'), participant: roles.has('participant') } };
    roles.forEach((socket) => send(socket, message));
  }

  wss.on('connection', (socket) => {
    let ownRole: CheckRole | undefined;
    // A socket that never declares its role must not reserve resources forever.
    const helloTimer = setTimeout(() => socket.close(1008, 'hello timeout'), 5000);
    helloTimer.unref();
    socket.on('error', () => { /* The close handler clears this connection's state. */ });
    socket.on('message', (raw, binary) => {
      const message = binary ? null : parseClientMessage(raw.toString());
      if (!message) {
        error(socket, '消息格式或版本不正确，请刷新检查页。');
        socket.close(1008, 'invalid message');
        return;
      }
      if (!ownRole) {
        if (message.type !== 'hello') { error(socket, '请先声明检查角色。'); socket.close(1008, 'hello required'); return; }
        if (roles.has(message.data.role)) {
          error(socket, '这个角色已有页面连接，请先断开旧页面，再重新连接。');
          socket.close(1008, 'role occupied');
          return;
        }
        clearTimeout(helloTimer);
        ownRole = message.data.role;
        roles.set(ownRole, socket);
        send(socket, { type: 'ready', data: { role: ownRole } });
        peers();
        return;
      }
      if (message.type === 'check.send' && ownRole === 'console') {
        const participant = roles.get('participant');
        if (!participant || participant.readyState !== WebSocket.OPEN) { error(socket, '参与者端尚未连接。'); return; }
        if (pending) { error(socket, '上一条测试指令仍在等待回复。'); return; }
        const id = message.data.id;
        const timer = setTimeout(() => {
          clearPending();
          error(roles.get('console'), '5 秒内没有收到回复，请检查参与者端后重试。');
        }, 5000);
        timer.unref();
        pending = { id, timer };
        send(participant, { type: 'check.command', data: { id } });
      } else if (message.type === 'check.received' && ownRole === 'participant') {
        if (!pending || pending.id !== message.data.id) { error(socket, '回复与当前测试指令不匹配。'); return; }
        clearPending();
        send(roles.get('console'), { type: 'check.received', data: message.data });
      } else error(socket, '当前角色不能发送这类消息。');
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      // A rejected duplicate must never remove the accepted owner's role.
      if (!ownRole || roles.get(ownRole) !== socket) return;
      roles.delete(ownRole);
      if (pending) {
        clearPending();
        error(roles.get('console'), '连接已中断，这条指令没有完成；重新连接后可再测。');
      }
      if (!closing) peers();
    });
  });

  function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const expected = `${secure ? 'https' : 'http'}://${request.headers.host}`;
    // Browser credentials are not used here. Require the same origin so other
    // websites cannot connect to the local diagnostic service through a browser.
    if (closing || request.headers.origin !== expected) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
  }
  async function close() {
    closing = true;
    clearPending();
    wss.clients.forEach((socket) => socket.terminate());
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }
  return { handleUpgrade, close };
}
