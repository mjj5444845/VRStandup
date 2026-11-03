import { getCondition, type ConditionId } from './conditions';
import type { Cue } from './materials';
export function orderedCues(cues: readonly Cue[]): Cue[] { return cues.map((cue, index) => ({ cue, index })).sort((a, b) => a.cue.atMs - b.cue.atMs || a.index - b.index).map(x => x.cue); }
export function crossedCues(cues: readonly Cue[], previousMs: number, nowMs: number, condition: ConditionId): Cue[] {
  if (!Number.isFinite(previousMs) || !Number.isFinite(nowMs) || previousMs < -1 || nowMs < previousMs) throw new Error('时间线不能倒退；跳转需明确重设游标。');
  const rule = getCondition(condition);
  return orderedCues(cues).filter(c => c.atMs > previousMs && c.atMs <= nowMs && (c.kind !== 'expressive' && c.kind !== 'distancing' || rule.captions.includes(c.kind)));
}
export function visibleCues(cues: readonly Cue[], nowMs: number, condition: ConditionId): Cue[] {
  const rule = getCondition(condition); return orderedCues(cues).filter(c => c.atMs <= nowMs && nowMs < c.endMs && (c.kind === 'expressive' || c.kind === 'distancing') && rule.captions.includes(c.kind));
}
