// Source: docs/design/SYSTEM_GUIDE.md, retained research rules. This is not an allocation schedule.
export const CONDITION_IDS = ['A', 'B', 'C', 'D'] as const;
export type ConditionId = typeof CONDITION_IDS[number];
export type CaptionKind = 'expressive' | 'distancing';
export type Condition = Readonly<{ id: ConditionId; name: string; captions: readonly CaptionKind[]; grab: boolean; throw: boolean; attachSelf: boolean; responses: boolean }>;
const define = (value: Condition): Condition => Object.freeze({ ...value, captions: Object.freeze([...value.captions]) });
export const CONDITIONS: Readonly<Record<ConditionId, Condition>> = Object.freeze({
  A: define({ id: 'A', name: '无花字', captions: [], grab: false, throw: false, attachSelf: false, responses: false }),
  B: define({ id: 'B', name: '写意花字', captions: ['expressive'], grab: true, throw: false, attachSelf: false, responses: false }),
  C: define({ id: 'C', name: '间离花字', captions: ['distancing'], grab: true, throw: false, attachSelf: false, responses: false }),
  D: define({ id: 'D', name: '花字与互动', captions: ['expressive', 'distancing'], grab: true, throw: true, attachSelf: true, responses: true }),
});
export const CAPTION_LABELS: Readonly<Record<CaptionKind, string>> = Object.freeze({ expressive: '写意', distancing: '间离' });
export function getCondition(input: unknown): Condition {
  if (typeof input !== 'string' || !Object.hasOwn(CONDITIONS, input)) throw new Error('条件必须是 A、B、C 或 D。');
  return CONDITIONS[input as ConditionId];
}
/** Both the condition and the cue must permit an action. Expressive cues are never throwable. */
export function captionPermissions(condition: ConditionId, cue: Readonly<{ kind: CaptionKind; throwable: boolean }>, target: 'self' | 'other' = 'self') {
  const rule = getCondition(condition);
  const visible = rule.captions.includes(cue.kind);
  return { visible, grab: visible && rule.grab, throw: visible && rule.throw && cue.kind === 'distancing' && cue.throwable, attach: visible && rule.attachSelf && target === 'self' };
}
export function canPlayResponse(condition: ConditionId, playedCount: number): boolean {
  if (!Number.isInteger(playedCount) || playedCount < 0) throw new Error('已播放回应次数必须是非负整数。');
  return getCondition(condition).responses && playedCount < 2;
}
