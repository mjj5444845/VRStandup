import type { Session } from './session';
import { validateEvidence, type Evidence } from './execution';
import type { MeasurementAudio } from './measurement';
import { gazeAngle } from './theatre';
import { object } from './validation';
export function auditExecution(session: Session, events: unknown[], audio: MeasurementAudio[] = []) {
  const records: Evidence[] = [], issues: string[] = [], warnings: string[] = [];
  for (const event of events) {
    if (object(event) && event.type === 'command' && event.accepted === true && object(event.command) && event.command.kind === 'capture') records.push(validateEvidence(event.command.evidence));
  }
  if (!session.execution) issues.push('手动流程预演缺少完整执行记录');
  if (session.stage !== 'completed') issues.push('会话未正常完成');
  const answerRecords = records.filter(e => e.kind === 'answers');
  for (const timing of ['pre', 'post']) if (!answerRecords.some(e => session.plan.questionnaires.some(q => q.id === e.questionnaireId && q.timing === timing))) issues.push(`${timing} 问卷记录缺失`);
  if (!records.some(e => e.kind === 'media' && e.ended && e.context.phase === 'practice')) issues.push('练习播放未完成');
  const rounds = Array.from({ length: 4 }, (_, round) => {
    const ended = records.some(e => e.kind === 'media' && e.ended && e.context.phase === 'main' && e.context.round === round);
    const answers = answerRecords.some(e => e.round === round && session.plan.questionnaires.some(q => q.id === e.questionnaireId && q.timing === 'round'));
    const samples = records.flatMap(e => e.kind === 'orientation' && e.context.round === round && e.context.phase === 'main' ? e.samples : []), angles = samples.map(p => gazeAngle(p.head, p.actorHead)).filter((v): v is number => v !== null);
    const mainId = session.plan.assignments.find(a => a.participantId === session.participantId)!.rounds[round].clipId;
    const recordings = audio.filter(a => a.round === round && a.clipId === mainId), interactions = records.filter(e => e.kind === 'interaction' && e.context.round === round).length;
    const performance = records.filter((e): e is Extract<Evidence, { kind: 'performance' }> => e.kind === 'performance' && e.context.round === round && e.context.phase === 'main'), frames = performance.reduce((n, p) => n + p.frames, 0), elapsed = performance.reduce((n, p) => n + p.elapsedMs, 0), meanFps = elapsed ? frames * 1000 / elapsed : null;
    const refresh = performance.find(p => p.source === 'xr' && p.refreshHz !== null)?.refreshHz ?? null;
    if (!performance.length) issues.push(`第 ${round + 1} 轮帧率记录缺失`);
    if (refresh && meanFps !== null && meanFps < refresh * .9) warnings.push(`第 ${round + 1} 轮平均帧率低于已记录刷新率的 90%，需实机复查`);
    if (!ended) issues.push(`第 ${round + 1} 轮播放记录缺失`); if (!answers) issues.push(`第 ${round + 1} 轮问卷缺失`); if (!samples.length) issues.push(`第 ${round + 1} 轮朝向缺失`);
    if (session.execution?.audioRequired && !recordings.length) issues.push(`第 ${round + 1} 轮要求录音但无文件`);
    if (samples.some(s => s.head === null || s.actorHead === null)) warnings.push(`第 ${round + 1} 轮存在无效追踪采样`);
    return { round: round + 1, ended, answers, samples: samples.length, missingTracking: samples.length - angles.length, meanAngleDegrees: angles.length ? angles.reduce((a, b) => a + b, 0) / angles.length : null, audioFiles: recordings.length, interactions, meanFps, refreshHz: refresh };
  });
  if (session.mode === 'rehearsal') warnings.push('工程预演：不能当作真实参与者研究结果');
  if (!audio.length) warnings.push('未保存实验麦克风录音');
  if (audio.some(a => a.source !== 'microphone')) warnings.push('包含合成测试录音');
  const interruptions = records.filter(e => e.kind === 'interruption').length;
  if (interruptions) warnings.push(`本轮存在 ${interruptions} 次中断，请复查`);
  return { schema: 'punchcap-audit-v1', sessionId: session.id, participantId: session.participantId, mode: session.mode, stage: session.stage, complete: !issues.length, issues, warnings, rounds, answerRecords: answerRecords.length, audioFiles: audio.length };
}
/** Neutralize spreadsheet formulas in exported free text. */
export function csvCell(value: unknown) { const s = String(value ?? ''), safe = /^[\s]*[=+\-@]/.test(s) ? `'${s}` : s; return `"${safe.replaceAll('"', '""')}"`; }
