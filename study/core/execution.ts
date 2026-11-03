import type { Session } from './session';
import { canPlayResponse, captionPermissions } from './conditions';
import { validateAnswers } from './plan';
import { assert, finite, id, object, text, tuple } from './validation';
import { gazeAngle, INTERACTION_LIMITS, onStage, ROOM } from './theatre';
import type { Pose, Vec3 } from './motion';
export type Execution = { kind: 'integrated'; practiceMs: number; responseMs: number; answers: string[]; audioRequired: boolean };
export type MediaContext = { round: number; clipId: string; phase: 'practice' | 'main' | 'response'; response: number };
export type OrientationSample = { elapsedMs: number; mediaMs: number; head: Pose | null; actorHead: Vec3 | null; source: 'desktop' | 'xr' };
export type Evidence =
  | { kind: 'media'; context: MediaContext; positionMs: number; ended: boolean }
  | { kind: 'answers'; questionnaireId: string; version: string; round: number; answers: Record<string, string | number> }
  | { kind: 'orientation'; context: MediaContext; samples: OrientationSample[] }
  | { kind: 'performance'; context: MediaContext; frames: number; elapsedMs: number; refreshHz: number | null; source: 'desktop' | 'xr' }
  | { kind: 'interaction'; context: MediaContext; cueId: string; atMs: number; action: 'show' | 'hide' | 'grab' | 'release' | 'stretch' | 'throw' | 'attach' | 'land'; target: 'self'; scale: number; position: Vec3; outcome?: 'stage' | 'floor' | 'outside' }
  | { kind: 'interruption'; reason: string };
export function validateExecution(value: unknown): Execution {
  assert(object(value) && value.kind === 'integrated' && finite(value.practiceMs) && value.practiceMs >= 0 && finite(value.responseMs) && value.responseMs >= 0 && Array.isArray(value.answers) && value.answers.every(v => text(v, 100)) && new Set(value.answers).size === value.answers.length && typeof value.audioRequired === 'boolean', '完整流程记录无效。');
  return value as Execution;
}
export function validateEvidence(input: unknown): Evidence {
  assert(object(input), '数据记录格式无效。');
  if (input.kind === 'answers') assert(id(input.questionnaireId) && id(input.version) && Number.isInteger(input.round) && finite(input.round) && input.round >= 0 && input.round < 4 && object(input.answers), '问卷记录无效。');
  else if (input.kind === 'interruption') assert(text(input.reason, 300), '中断原因无效。');
  else {
    const c = input.context;
    assert(object(c) && Number.isInteger(c.round) && finite(c.round) && c.round >= 0 && c.round < 4 && id(c.clipId) && ['practice', 'main', 'response'].includes(String(c.phase)) && Number.isInteger(c.response) && finite(c.response) && c.response >= 0 && c.response <= 2, '媒体上下文无效。');
    if (input.kind === 'media') assert(finite(input.positionMs) && input.positionMs >= 0 && typeof input.ended === 'boolean', '媒体进度无效。');
    else if (input.kind === 'performance') assert(Number.isSafeInteger(input.frames) && finite(input.frames) && input.frames > 0 && input.frames < 10000000 && finite(input.elapsedMs) && input.elapsedMs > 0 && input.elapsedMs <= 3600000 && (input.refreshHz === null || finite(input.refreshHz) && input.refreshHz > 0 && input.refreshHz <= 1000) && ['desktop', 'xr'].includes(String(input.source)), '帧率采样无效。');
    else if (input.kind === 'orientation') {
      assert(Array.isArray(input.samples) && input.samples.length > 0 && input.samples.length <= 60, '朝向批次过大或为空。'); let previous = -1;
      for (const s of input.samples) {
        assert(object(s) && finite(s.elapsedMs) && s.elapsedMs > previous && finite(s.mediaMs) && s.mediaMs >= 0 && ['desktop', 'xr'].includes(String(s.source)) && (s.actorHead === null || tuple(s.actorHead, 3)), '朝向时间或来源无效。');
        if (s.head !== null) assert(object(s.head) && tuple(s.head.position, 3) && tuple(s.head.orientation, 4) && Math.abs(Math.hypot(...s.head.orientation as number[]) - 1) < .01, '头部姿态无效。'); previous = s.elapsedMs;
      }
    } else if (input.kind === 'interaction') assert(id(input.cueId) && finite(input.atMs) && input.atMs >= 0 && ['show', 'hide', 'grab', 'release', 'stretch', 'throw', 'attach', 'land'].includes(String(input.action)) && input.target === 'self' && finite(input.scale) && input.scale >= INTERACTION_LIMITS.minScale && input.scale <= INTERACTION_LIMITS.maxScale && tuple(input.position, 3) && (input.outcome === undefined || ['stage', 'floor', 'outside'].includes(String(input.outcome))), '交互记录无效。');
    else throw new Error('未知的数据记录类型。');
  }
  return input as Evidence;
}
export function mediaContext(s: Session): MediaContext | null {
  const stage = s.stage === 'paused' ? s.resumeStage : s.stage;
  const round = s.plan.assignments.find(a => a.participantId === s.participantId)!.rounds[s.roundIndex];
  return stage === 'practice' ? { phase: 'practice', clipId: s.plan.practiceClipId, round: s.roundIndex, response: 0 }
    : stage === 'playing' ? { phase: 'main', clipId: round.clipId, round: s.roundIndex, response: 0 }
    : stage === 'responding' && s.responseId ? { phase: 'response', clipId: s.responseId, round: s.roundIndex, response: s.responseCount } : null;
}
export function contextKey(c: MediaContext) { return `${c.round}:${c.phase}:${c.clipId}:${c.response}`; }
export function applyEvidence(state: Session, input: unknown, now: number): Session {
  const e = validateEvidence(input); assert(state.execution && state.connected && state.ready && !['completed', 'aborted'].includes(state.stage), '当前场次不能接收完整流程记录。');
  const s = structuredClone(state), run = s.execution!;
  if (e.kind === 'interruption') {
    if (s.stage !== 'paused') { s.resumeStage = s.stage; s.stage = 'paused'; s.version++; } s.updatedAt = now; return s;
  }
  if (e.kind === 'answers') {
    const timing = s.stage === 'pre-questionnaire' ? 'pre' : s.stage === 'round-questionnaire' ? 'round' : s.stage === 'post-questionnaire' ? 'post' : null;
    const q = s.plan.questionnaires.find(q => q.id === e.questionnaireId && q.timing === timing && q.version === e.version);
    assert(q && e.round === s.roundIndex, '问卷版本、时点或轮次不一致。'); validateAnswers(q, e.answers);
    const key = `${q.timing}:${s.roundIndex}`; assert(!run.answers.includes(key), '本阶段问卷已提交。'); run.answers.push(key);
    s.stage = timing === 'pre' ? 'practice' : timing === 'post' ? 'completed' : s.roundIndex === 3 ? 'post-questionnaire' : 'break'; s.version++; s.updatedAt = now; return s;
  }
  const context = mediaContext(s); assert(context && contextKey(e.context) === contextKey(context) && s.stage !== 'paused', '媒体片段、回应或轮次不一致，或当前已暂停。');
  const clip = s.plan.clips.find(c => c.id === context.clipId)!;
  if (e.kind === 'media') {
    const previous = context.phase === 'main' ? s.positionMs : context.phase === 'practice' ? run.practiceMs : run.responseMs;
    assert(e.positionMs >= previous && e.positionMs <= clip.durationMs && (!e.ended || e.positionMs === clip.durationMs), '媒体进度倒退、越界或尚未结束。');
    if (context.phase === 'main') s.positionMs = e.positionMs; else if (context.phase === 'practice') run.practiceMs = e.positionMs; else run.responseMs = e.positionMs;
    if (e.ended) { s.stage = context.phase === 'practice' ? 'round-ready' : context.phase === 'main' ? 'round-questionnaire' : 'playing'; if (context.phase === 'response') s.responseId = null; s.version++; }
  } else if (e.kind === 'performance') {
    s.updatedAt = now;
  } else if (e.kind === 'orientation') {
    assert(e.samples.every(p => p.mediaMs <= clip.durationMs), '朝向采样超出片段。');
    // Recompute angles from the recorded positions; never trust a client-supplied angle.
    e.samples.forEach(p => gazeAngle(p.head, p.actorHead));
  } else {
    const cue = clip.cues.find(c => c.id === e.cueId); assert(cue && (cue.kind === 'expressive' || cue.kind === 'distancing') && e.atMs <= clip.durationMs, '交互对象不是当前花字。');
    const round = s.plan.assignments.find(a => a.participantId === s.participantId)!.rounds[s.roundIndex];
    const permissions = captionPermissions(context.phase === 'practice' ? 'D' : round.condition, { kind: cue.kind, throwable: cue.throwable });
    assert(permissions.visible && (e.action === 'hide' || e.action === 'land' || e.atMs >= cue.atMs && e.atMs < cue.endMs), '花字不可见或已过期。');
    assert(!['grab', 'release', 'stretch'].includes(e.action) || permissions.grab, '当前不能抓取。');
    assert(!['throw', 'land'].includes(e.action) || permissions.throw, '当前不能投掷。'); assert(e.action !== 'attach' || permissions.attach, '只能挂载到参与者自身。');
    if (e.action === 'land' && e.outcome === 'stage') {
      assert(onStage(e.position) && Math.abs(e.position[1] - ROOM.stageHeight) < .02, '落点不在舞台表面。');
      const response = s.plan.responses[clip.id]?.[0];
      if (response && canPlayResponse(round.condition, s.responseCount) && clip.cues.some(c => c.kind === 'response-window' && c.atMs <= e.atMs && e.atMs < c.endMs)) { s.stage = 'responding'; s.responseId = response; s.responseCount++; run.responseMs = 0; s.version++; }
    }
  }
  s.updatedAt = now; return s;
}
