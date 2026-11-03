import { canPlayResponse } from './conditions';
import { type Plan, studyPlanIssues, validatePlan } from './plan';
import { assert, finite, id, object, text } from './validation';
import { validateExecution, type Execution } from './execution';
export const STAGES = ['created', 'ready', 'pre-questionnaire', 'practice', 'round-ready', 'playing', 'responding', 'round-questionnaire', 'break', 'post-questionnaire', 'paused', 'completed', 'aborted'] as const;
export type Stage = typeof STAGES[number];
export type Session = {
  schema: 'punchcap-session-v1'; id: string; participantId: string; mode: 'rehearsal' | 'study'; version: number;
  plan: Plan; stage: Stage; resumeStage: Stage | null; roundIndex: number; positionMs: number;
  connected: boolean; ready: boolean; responseCount: number; responseId: string | null; updatedAt: number; abortReason: string | null;
  execution?: Execution;
};
export type ActionKind = 'advance' | 'pause' | 'resume' | 'abort' | 'note' | 'ready' | 'preDone' | 'practiceDone' | 'roundDone' | 'surveyDone' | 'postDone' | 'progress' | 'respond' | 'responseDone' | 'resetParticipant';
export type Action = { kind: ActionKind; sessionId: string; expectedVersion: number; value?: string | number };
export function createSession(sessionId: string, participantId: string, input: unknown, mode: Session['mode'], now: number): Session {
  const plan = validatePlan(input); assert(id(sessionId) && id(participantId) && plan.assignments.some(a => a.participantId === participantId) && ['rehearsal', 'study'].includes(mode) && finite(now), '会话编号、参与者或运行模式无效。');
  if (mode === 'study') { const issues = studyPlanIssues(plan); assert(!issues.length, `正式研究被阻止：${issues.join('；')}`); }
  return { schema: 'punchcap-session-v1', id: sessionId, participantId, mode, version: 0, plan, stage: 'created', resumeStage: null, roundIndex: 0, positionMs: 0, connected: false, ready: false, responseCount: 0, responseId: null, updatedAt: now, abortReason: null };
}
export function currentRound(session: Session) { return session.plan.assignments.find(a => a.participantId === session.participantId)!.rounds[session.roundIndex]; }
export function currentClip(session: Session) { return session.plan.clips.find(c => c.id === currentRound(session).clipId)!; }
const operatorOnly = ['advance', 'resume', 'abort', 'respond', 'resetParticipant'];
const participantOnly = ['ready', 'preDone', 'practiceDone', 'roundDone', 'surveyDone', 'postDone', 'progress', 'responseDone'];
export function applyAction(state: Session, action: Action, role: 'operator' | 'participant', now: number): Session {
  assert(action.sessionId === state.id && finite(now), '会话身份或时间无效。');
  assert(!(operatorOnly.includes(action.kind) && role !== 'operator') && !(participantOnly.includes(action.kind) && role !== 'participant'), '当前身份不能执行该操作。');
  if (action.kind !== 'note') assert(action.expectedVersion === state.version, '状态已变化，请查看最新状态后重新操作。');
  if (action.kind === 'note') { assert(text(action.value, 2000), '备注不能为空或过长。'); return state; }
  assert(!state.execution || !['preDone', 'practiceDone', 'roundDone', 'surveyDone', 'postDone', 'progress', 'responseDone'].includes(action.kind), '完整流程需由实际播放和作答记录完成，不能用手动确认跳过。');
  assert(!['completed', 'aborted'].includes(state.stage), '会话已结束，不能继续改变流程。');
  const s: Session = { ...state, version: state.version + 1, updatedAt: now };
  if (action.kind === 'abort') { assert(text(action.value, 500), '中止需要填写原因。'); return { ...s, stage: 'aborted', abortReason: action.value, responseId: null }; }
  if (action.kind === 'ready') { assert(s.connected, '参与者尚未连接。'); assert(!s.execution?.audioRequired || action.value === 'microphone-prepared', '本场次要求先准备实验麦克风。'); s.ready = true; return s; }
  if (action.kind === 'resetParticipant') return { ...s, ready: false, connected: false, resumeStage: s.stage === 'paused' ? s.resumeStage : s.stage, stage: 'paused' };
  assert(s.connected && s.ready, '参与者未连接或尚未确认准备完成。');
  if (action.kind === 'pause') { assert(!['paused', 'created'].includes(s.stage), '当前不能暂停。'); return { ...s, resumeStage: s.stage, stage: 'paused' }; }
  if (action.kind === 'resume') { assert(s.stage === 'paused' && s.resumeStage, '当前没有可恢复阶段。'); return { ...s, stage: s.resumeStage, resumeStage: null }; }
  if (action.kind === 'advance') {
    if (s.stage === 'created') s.stage = 'ready';
    else if (s.stage === 'ready') s.stage = 'pre-questionnaire';
    else if (s.stage === 'round-ready') s.stage = 'playing';
    else if (s.stage === 'break') { s.roundIndex++; s.stage = 'round-ready'; s.positionMs = 0; s.responseCount = 0; }
    else throw new Error('当前阶段需等待参与者完成，不能强行跳过。');
    return s;
  }
  if (action.kind === 'preDone') { assert(s.stage === 'pre-questionnaire', '当前不是前测阶段。'); s.stage = 'practice'; }
  else if (action.kind === 'practiceDone') { assert(s.stage === 'practice', '当前不是练习阶段。'); s.stage = 'round-ready'; }
  else if (action.kind === 'roundDone') { assert(s.stage === 'playing', '当前不是主片段播放。'); s.stage = 'round-questionnaire'; s.positionMs = currentClip(s).durationMs; }
  else if (action.kind === 'surveyDone') { assert(s.stage === 'round-questionnaire', '当前不是轮后问卷。'); s.stage = s.roundIndex === 3 ? 'post-questionnaire' : 'break'; }
  else if (action.kind === 'postDone') { assert(s.stage === 'post-questionnaire', '当前不是后测阶段。'); s.stage = 'completed'; }
  else if (action.kind === 'progress') { assert(s.stage === 'playing' && finite(action.value) && action.value >= s.positionMs && action.value <= currentClip(s).durationMs, '播放进度越界或倒退。'); s.positionMs = action.value; }
  else if (action.kind === 'respond') {
    const round = currentRound(s), clip = currentClip(s), options = s.plan.responses[clip.id] ?? [];
    assert(s.stage === 'playing' && canPlayResponse(round.condition, s.responseCount) && typeof action.value === 'string' && options.includes(action.value)
      && clip.cues.some(c => c.kind === 'response-window' && c.atMs <= s.positionMs && s.positionMs < c.endMs), '当前条件、回应次数或回应窗口不允许回应。');
    s.stage = 'responding'; s.responseId = action.value; s.responseCount++; if (s.execution) s.execution = { ...s.execution, responseMs: 0 };
  } else if (action.kind === 'responseDone') { assert(s.stage === 'responding', '当前没有正在播放的回应。'); s.stage = 'playing'; s.responseId = null; }
  return s;
}
export function connectionChanged(s: Session, connected: boolean, now: number): Session {
  if (s.connected === connected) return s;
  const next = { ...s, connected, ready: false, version: s.version + 1, updatedAt: now };
  if (!connected && !['created', 'paused', 'completed', 'aborted'].includes(s.stage)) { next.resumeStage = s.stage; next.stage = 'paused'; }
  return next;
}
export function validateSession(value: unknown): Session {
  assert(object(value) && value.schema === 'punchcap-session-v1' && id(value.id) && id(value.participantId) && ['rehearsal', 'study'].includes(String(value.mode))
    && Number.isSafeInteger(value.version) && finite(value.version) && value.version >= 0 && STAGES.includes(value.stage as Stage)
    && (value.resumeStage === null || STAGES.includes(value.resumeStage as Stage)) && Number.isInteger(value.roundIndex) && finite(value.roundIndex) && value.roundIndex >= 0 && value.roundIndex < 4
    && finite(value.positionMs) && value.positionMs >= 0 && typeof value.connected === 'boolean' && typeof value.ready === 'boolean' && Number.isInteger(value.responseCount) && finite(value.responseCount) && value.responseCount >= 0 && value.responseCount <= 2
    && (value.responseId === null || id(value.responseId)) && finite(value.updatedAt) && (value.abortReason === null || text(value.abortReason, 500)), '会话快照格式无效。');
  validatePlan(value.plan); if (value.execution !== undefined) validateExecution(value.execution); const s = value as Session; assert(s.plan.assignments.some(a => a.participantId === s.participantId) && s.positionMs <= currentClip(s).durationMs, '会话安排或进度不一致。'); return s;
}
