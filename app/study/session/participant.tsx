'use client';
import { useEffect, useRef, useState } from 'react';
import { createLabClient, sessionStageLabel, stableClientId, type ClientState } from '@/study/web/lab-client';
import { loadPrivateClip, downloadRunReport, type RunIdentity, type Evidence } from '@/study/web/runtime-api';
import { uploadMeasurement } from '@/study/web/measurement-audio';
import { RunView } from '../runtime/run-view';
export function ParticipantSession() {
  const [sid, setSid] = useState(''), [key, setKey] = useState(''), [state, setState] = useState<ClientState | null>(null), [notice, setNotice] = useState(''), [audioReady, setAudioReady] = useState(false);
  const client = useRef<ReturnType<typeof createLabClient> | null>(null), identity = useRef<RunIdentity | null>(null); useEffect(() => () => client.current?.dispose(), []);
  const session = state?.sessions[0], blocked = state?.status !== 'connected' || Boolean(state.pending);
  function connect() {
    try {
      client.current?.dispose(); const clientId = stableClientId(localStorage, `punchcap-client:${sid}`); identity.current = { sessionId: sid, key, clientId };
      client.current = createLabClient({ url: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/lab-ws`, hello: { v: 1, type: 'hello', role: 'participant', clientId, key, sessionId: sid }, storage: localStorage, onChange: value => { setState(value); if (value.lastReceipt && !value.lastReceipt.ok) setNotice(value.lastReceipt.error ?? '记录被拒绝。'); } });
    } catch (e) { setNotice(String(e)); }
  }
  function act(kind: 'ready' | 'preDone' | 'practiceDone' | 'roundDone' | 'surveyDone' | 'postDone' | 'responseDone' | 'progress' | 'pause', value?: number | string) { if (!session) return; try { client.current?.command({ kind, sessionId: session.id, expectedVersion: session.version, ...(value === undefined ? {} : { value }) }); } catch (e) { setNotice(String(e)); } }
  function capture(evidence: Evidence) { if (!session) return; try { client.current?.command({ kind: 'capture', sessionId: session.id, evidence }); } catch (e) { setNotice(String(e)); } }
  const stages = { 'pre-questionnaire': ['preDone', '手动预演：前测完成'], practice: ['practiceDone', '手动预演：练习完成'], playing: ['roundDone', '手动预演：主片段完成'], responding: ['responseDone', '手动预演：回应完成'], 'round-questionnaire': ['surveyDone', '手动预演：本轮问卷完成'], 'post-questionnaire': ['postDone', '手动预演：后测完成'] } as const;
  const next = session && Object.hasOwn(stages, session.stage) ? stages[session.stage as keyof typeof stages] : null;
  return <><section className="work-card"><label>场次编号 <input value={sid} onChange={e => setSid(e.target.value)}/></label><label>参与者配对密钥 <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/></label><button disabled={!sid || !key} onClick={connect}>连接场次</button><p role="status">{state?.message ?? '请输入实验员提供的场次及参与者密钥。'}</p><button disabled={!state?.pending || state.status !== 'error'} onClick={() => client.current?.retry()}>重试未确认记录</button><p>待确认记录 {state?.pending ?? 0} 条。断线后需重新就绪并由实验员恢复。</p></section>
    {session && <><section className="work-card"><h2>{session.id} / {session.participantId}</h2><p>阶段：{sessionStageLabel(session.stage)} · 第 {session.roundIndex + 1}/4 轮 · {session.execution ? '完整工程预演' : '手动流程检查'}</p><button disabled={blocked || session.ready || ['completed', 'aborted'].includes(session.stage) || Boolean(session.execution?.audioRequired && !audioReady)} onClick={() => act('ready', audioReady ? 'microphone-prepared' : undefined)}>确认准备完成</button>{!session.execution && next && <button disabled={blocked || session.mode !== 'rehearsal'} onClick={() => act(next[0])}>{next[1]}</button>}{!session.execution && session.stage === 'playing' && <label>手动检查进度<input type="range" min={session.positionMs} max={session.plan.clips.find(c => c.id === session.plan.assignments.find(a => a.participantId === session.participantId)!.rounds[session.roundIndex].clipId)!.durationMs} step={100} value={session.positionMs} disabled={blocked} onChange={e => act('progress', Number(e.target.value))}/></label>}{session.stage === 'paused' && <p>已暂停。重新连接后确认准备，再由实验员恢复。</p>}</section>
      {session.execution && <RunView key={session.id} session={session} blocked={state?.status !== 'connected'} capture={capture} onAudioReady={setAudioReady} loadClip={id => { if (!identity.current) throw new Error('身份尚未准备。'); return loadPrivateClip(identity.current, id); }} report={() => { if (!identity.current) throw new Error('身份尚未准备。'); return downloadRunReport(identity.current); }} saveAudio={segment => { if (!identity.current) throw new Error('身份尚未准备。'); return uploadMeasurement(identity.current, segment); }}/>}</>}
    <p role="alert">{notice}</p></>;
}
