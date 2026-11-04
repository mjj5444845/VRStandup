import { validateManifest } from '../core/materials';
import { validateRecording, waveBytes } from '../core/recording';
import { object, assert } from '../core/validation';
import type { RunClip } from '../core/scene-interface';
export { mediaContext, contextKey, applyEvidence } from '../core/execution';
export { engineeringSession, engineeringClip } from '../core/engineering';
export { applyAction } from '../core/session';
export { auditExecution } from '../core/audit';
export { validateAnswers } from '../core/plan';
export type { Session, ActionKind } from '../core/session';
export type { Evidence, MediaContext } from '../core/execution';
export type { Questionnaire } from '../core/plan';
export type { ScenePanel, SceneInfo, RunClip } from '../core/scene-interface';
export { initialSceneInfo } from '../core/scene-interface';
export type RunIdentity = { sessionId: string; key: string; clientId: string };
export function runHeaders(identity: RunIdentity) { return { Authorization: `Bearer ${identity.key}`, 'x-punchcap-session': identity.sessionId, 'x-punchcap-client': identity.clientId }; }
export async function loadPrivateClip(identity: RunIdentity, id: string): Promise<RunClip> {
  const response = await fetch(`/api/run/clip?clip=${encodeURIComponent(id)}`, { headers: runHeaders(identity), cache: 'no-store' });
  if (!response.ok) throw new Error('片段读取被拒绝，请检查场次与实验室服务。'); const value: unknown = await response.json(); assert(object(value), '片段数据无效。');
  const manifest = validateManifest(value.manifest), take = validateRecording(value.take); assert(manifest.id === id && take.id === manifest.takeId && take.durationMs === manifest.durationMs, '素材身份或时长不符。');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', waveBytes(take).slice().buffer as ArrayBuffer)); assert([...hash].map(v => v.toString(16).padStart(2, '0')).join('') === manifest.files.audio.sha256, '声音校验失败。'); return { manifest, take };
}
export async function downloadRunReport(identity: RunIdentity) {
  const response = await fetch('/api/run/report', { headers: runHeaders(identity), cache: 'no-store' }); if (!response.ok) throw new Error('检查报告暂时不可用。'); return response.json() as Promise<unknown>;
}
export function reportStatus(value: unknown) {
  if (!object(value) || !object(value.audit) || typeof value.audit.complete !== 'boolean' || !Array.isArray(value.audit.issues) || !Array.isArray(value.audit.warnings)) return null;
  return { complete: value.audit.complete, issues: value.audit.issues.filter((v): v is string => typeof v === 'string'), warnings: value.audit.warnings.filter((v): v is string => typeof v === 'string') };
}
