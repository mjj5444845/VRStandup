import { validatePlan, type Plan } from './plan';
import { assert, exact, finite, id, object, text } from './validation';
import type { Action, Session } from './session';
export const PROTOCOL_VERSION = 1;
export const SOCKET_PATH = '/lab-ws';
export const MAX_MESSAGE_BYTES = 1024 * 1024;
export type Role = 'operator' | 'participant';
export type Hello = { v: 1; type: 'hello'; role: Role; clientId: string; key: string; sessionId?: string };
export type CreateCommand = { kind: 'create'; sessionId: string; participantId: string; mode: 'rehearsal' | 'study'; plan: Plan };
export type Command = Action | CreateCommand;
export type Request = { v: 1; type: 'command'; id: string; command: Command; clientTimeMs: number; clock?: { offsetMs: number; rttMs: number } };
export type Receipt = { v: 1; type: 'receipt'; id: string; ok: boolean; error?: string; snapshot?: Session; joinKey?: string };
export type ServerMessage = Receipt | { v: 1; type: 'welcome'; role: Role; sessions: Session[] } | { v: 1; type: 'snapshot'; snapshot: Session } | { v: 1; type: 'clock'; t0: number; s1: number; s2: number } | { v: 1; type: 'error'; error: string; id?: string; retryable?: boolean };
export function parseHello(value: unknown): Hello {
  assert(object(value) && exact(value, ['v', 'type', 'role', 'clientId', 'key', 'sessionId']) && value.v === 1 && value.type === 'hello' && ['operator', 'participant'].includes(String(value.role)) && id(value.clientId) && text(value.key, 200) && (value.sessionId === undefined || id(value.sessionId)) && (value.role !== 'participant' || id(value.sessionId)), '连接身份、协议版本或会话编号无效。'); return value as Hello;
}
export function parseRequest(value: unknown): Request {
  assert(object(value) && exact(value, ['v', 'type', 'id', 'command', 'clientTimeMs', 'clock']) && value.v === 1 && value.type === 'command' && id(value.id) && finite(value.clientTimeMs) && object(value.command), '指令格式或版本无效。');
  if (value.clock !== undefined) assert(object(value.clock) && exact(value.clock, ['offsetMs', 'rttMs']) && finite(value.clock.offsetMs) && finite(value.clock.rttMs) && value.clock.rttMs >= 0 && value.clock.rttMs <= 60000, '时钟估计无效。');
  const c = value.command;
  if (c.kind === 'create') {
    assert(exact(c, ['kind', 'sessionId', 'participantId', 'mode', 'plan']) && id(c.sessionId) && id(c.participantId) && ['rehearsal', 'study'].includes(String(c.mode)), '新会话指令无效。'); validatePlan(c.plan);
  } else {
    assert(exact(c, ['kind', 'sessionId', 'expectedVersion', 'value']) && ['advance', 'pause', 'resume', 'abort', 'note', 'ready', 'preDone', 'practiceDone', 'roundDone', 'surveyDone', 'postDone', 'progress', 'respond', 'responseDone', 'resetParticipant'].includes(String(c.kind)) && id(c.sessionId) && Number.isSafeInteger(c.expectedVersion) && finite(c.expectedVersion) && c.expectedVersion >= 0, '会话动作无效。');
    assert(c.value === undefined || text(c.value, 2000) || finite(c.value), '指令内容无效。');
  }
  return value as Request;
}
export function estimateClock(t0: number, s1: number, s2: number, t3: number) {
  assert([t0, s1, s2, t3].every(finite) && t3 >= t0 && s2 >= s1, '时钟采样发生倒退。');
  const rttMs = t3 - t0 - (s2 - s1); assert(rttMs >= 0 && rttMs <= 60000, '时钟采样延迟无效。');
  return { offsetMs: ((s1 - t0) + (s2 - t3)) / 2, rttMs, uncertaintyMs: rttMs / 2 };
}
