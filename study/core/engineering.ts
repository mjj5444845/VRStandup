import { demoPlan } from './demo';
import { createSession, type Session } from './session';
import { syntheticTake } from './synthetic-take';
import { validateCues } from './materials';
import { CLUB_MAPPING } from './club-assets';
/** Original substitute content, never an approved questionnaire, actor or allocation. */
export function engineeringPlan() {
  const plan = demoPlan(); plan.id = 'integrated-engineering-club-v1';
  for (const clip of plan.clips.filter(c => c.kind === 'main' || c.kind === 'practice')) clip.cues = validateCues([
    { id: 'expressive', atMs: 600, endMs: 2500, kind: 'expressive', anchor: 'rightHand', offset: [0, .25, 0], assetId: 'expressive-wow', throwable: false },
    { id: 'punchline-pause', atMs: 3000, endMs: 3300, kind: 'pause', anchor: 'stage', offset: [0, 0, 0], assetId: '', throwable: false },
    { id: 'laugh', atMs: 4000, endMs: 5500, kind: 'laugh', anchor: 'stage', offset: [0, 0, 0], assetId: 'generated-reaction', throwable: false },
    { id: 'distancing', atMs: 4600, endMs: 9000, kind: 'distancing', anchor: 'leftHand', offset: [0, .35, 0], assetId: 'distancing-plan', throwable: true },
    { id: 'window', atMs: 2000, endMs: 11000, kind: 'response-window', anchor: 'stage', offset: [0, 0, 0], assetId: '', throwable: false },
  ], clip.durationMs);
  plan.questionnaires[1].questions = [{ id: 'demo-rating', kind: 'number', prompt: '工程样例评分：请任选 0–10，检验评分保存（非研究量表）', min: 0, max: 10, required: true }];
  plan.questionnaires[2].questions.push({ id: 'demo-comment', kind: 'text', prompt: '可选：记录本次预演的问题（非研究题目）', maxLength: 1000, required: false });
  for (const clip of plan.clips) { clip.id = `club-flow-${clip.id}`; clip.takeId = clip.id; clip.model = structuredClone(CLUB_MAPPING); }
  plan.practiceClipId = `club-flow-${plan.practiceClipId}`;
  for (const a of plan.assignments) for (const r of a.rounds) r.clipId = `club-flow-${r.clipId}`;
  plan.responses = Object.fromEntries(Object.entries(plan.responses).map(([key, list]) => [`club-flow-${key}`, list.map(id => `club-flow-${id}`)]));
  return plan;
}
export function engineeringSession(): Session {
  const s = createSession('LOCAL-DEMO', 'DEMO1', engineeringPlan(), 'rehearsal', Date.now());
  return { ...s, connected: true, ready: true, stage: 'pre-questionnaire', execution: { kind: 'integrated', practiceMs: 0, responseMs: 0, answers: [], audioRequired: false } };
}
export function engineeringClip(id: string) {
  const manifest = engineeringPlan().clips.find(c => c.id === id); if (!manifest) throw new Error('未知的工程片段。');
  return { manifest, take: syntheticTake(id) };
}
