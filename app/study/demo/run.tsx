'use client';
import { useRef, useState } from 'react';
import { applyAction, applyEvidence, auditExecution, engineeringClip, engineeringSession, type Evidence, type Session } from '@/study/web/runtime-api';
import { sessionStageLabel } from '@/study/web/lab-client';
import { RunView } from '../runtime/run-view';
export function EngineeringRun() {
  const [session, setSession] = useState<Session>(() => engineeringSession()), [notice, setNotice] = useState(''), current = useRef(session), events = useRef<unknown[]>([]);
  function capture(evidence: Evidence) { try { const next = applyEvidence(current.current, evidence, Date.now()); events.current.push({ type: 'command', command: { kind: 'capture', evidence }, accepted: true }); current.current = next; setSession(next); setNotice(''); } catch (e) { setNotice(String(e)); } }
  function action(kind: 'advance' | 'resume') { try { const s = current.current, next = applyAction(s, { kind, sessionId: s.id, expectedVersion: s.version }, 'operator', Date.now()); current.current = next; setSession(next); } catch (e) { setNotice(String(e)); } }
  return <><p>第 {session.roundIndex + 1}/4 轮 · {sessionStageLabel(session.stage)} · 条件 {session.plan.assignments[0].rounds[session.roundIndex].condition}</p><RunView session={session} blocked={false} capture={capture} loadClip={async id => engineeringClip(id)} advance={() => action('advance')} resume={() => action('resume')} report={async () => ({ schema: 'punchcap-browser-engineering-export-v1', audit: auditExecution(current.current, events.current), events: events.current })}/><p role="alert">{notice}</p></>;
}
