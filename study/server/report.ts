import { auditExecution, csvCell } from '../core/audit';
import { object, assert, canonicalJson } from '../core/validation';
import type { Session } from '../core/session';
import type { Entry } from '../storage/journal';
import { listMeasurements } from '../storage/measurements';
export async function executionReport(root: string, session: Session, entries: Entry[]) {
  const files = await listMeasurements(root, session.id);
  const recorded = entries.flatMap(e => object(e.event) && e.event.type === 'measurement-audio' ? [e.event.audio] : []);
  for (const a of recorded) assert(files.some(f => canonicalJson(f) === canonicalJson(a)), '日志引用的录音缺失或不符。');
  const audio = files.filter(f => recorded.some(a => canonicalJson(a) === canonicalJson(f))), events = entries.map(e => e.event), audit = auditExecution(session, events, audio);
  if (audio.length !== files.length) { audit.issues.push('存在未确认的录音文件，需保留并复查'); audit.complete = false; }
  const evidence = events.filter(e => object(e) && e.type === 'command' && e.accepted === true && object(e.command) && e.command.kind === 'capture');
  const csv = [['session', 'participant', 'round', 'played', 'answered', 'orientation_samples', 'missing_tracking', 'mean_angle_degrees', 'audio_files', 'interactions', 'mean_fps', 'refresh_hz'].map(csvCell).join(','), ...audit.rounds.map(r => [session.id, session.participantId, r.round, r.ended, r.answers, r.samples, r.missingTracking, r.meanAngleDegrees, r.audioFiles, r.interactions, r.meanFps, r.refreshHz].map(csvCell).join(','))].join('\r\n');
  return { schema: 'punchcap-export-v1', sessionId: session.id, participantId: session.participantId, planId: session.plan.id, planVersion: session.plan.version, lastJournalHash: entries.at(-1)?.hash ?? null, audit, audio, evidence, csv };
}
