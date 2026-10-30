'use client';

import { useEffect, useRef, useState } from 'react';
import { createNetworkClient, INITIAL_NETWORK } from '@/study/spikes/network-client';
import type { CheckRole } from '@/study/spikes/network-protocol';
import styles from './network.module.css';

export function NetworkCheck({ role }: { role: CheckRole }) {
  const [state, setState] = useState(INITIAL_NETWORK);
  const clientRef = useRef<ReturnType<typeof createNetworkClient> | null>(null);
  useEffect(() => {
    const client = createNetworkClient(role, setState);
    clientRef.current = client;
    // Strict Mode's trial mount is cleaned up before this microtask runs.
    queueMicrotask(client.connect);
    return () => {
      client.dispose();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [role]);
  const connected = state.phase === 'connected';
  return (
    <section className={styles.panel} aria-label="通信状态">
      <div className={styles.statusLine}>
        <span className={connected ? styles.connected : styles.disconnected} aria-hidden="true" />
        <h2>{connected ? '已连接检查服务' : state.phase === 'connecting' ? '正在连接' : '尚未连接'}</h2>
      </div>
      <p role="status" aria-live="polite" className={styles.message}>{state.message}</p>
      <dl className={styles.peers}>
        <div><dt>实验员端</dt><dd>{state.peers.console ? '已就绪' : '未连接'}</dd></div>
        <div><dt>参与者端</dt><dd>{state.peers.participant ? '已就绪' : '未连接'}</dd></div>
      </dl>
      <div className={styles.buttons}>
        {role === 'console' && <button
          className={styles.primary}
          onClick={() => clientRef.current?.sendProbe()}
          disabled={!connected || !state.peers.participant || state.awaiting}
        >{state.awaiting ? '等待回复…' : '发送测试指令'}</button>}
        <button onClick={() => clientRef.current?.connect()} disabled={state.phase !== 'disconnected'}>重新连接</button>
        <button onClick={() => clientRef.current?.disconnect()} disabled={state.phase === 'disconnected'}>断开连接</button>
      </div>
      <p className={styles.hint}>{role === 'console'
        ? `已发送 ${state.sent} 条，已确认收到 ${state.received} 条回复。`
        : `已收到 ${state.received} 条测试指令；收到后自动回复，不需要额外点击。`}</p>
      <h3>最近 8 条消息记录</h3>
      {state.events.length ? <ol className={styles.history}>{state.events.map((event) => <li key={event.number}>{event.text}</li>)}</ol>
        : <p className={styles.hint}>连接后，这里会显示本次检查的消息。</p>}
      <p className={styles.hint}>记录只保留在当前页面，刷新后清空；不保存参与者资料。</p>
    </section>
  );
}
