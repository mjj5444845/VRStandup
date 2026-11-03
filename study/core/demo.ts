import { DRAFT, type ClipManifest, type Mapping } from './materials';
import { validatePlan, type Plan } from './plan';
export const REFERENCE_MAPPING: Mapping = { id: 'reference-targets-v1', modelId: 'engineering-reference', modelVersion: 'v1', heightMetres: 1.7,
  nodes: { head: 'head', leftHand: 'leftHand', rightHand: 'rightHand' }, offsets: { head: [0, 0, 0], leftHand: [0, 0, 0], rightHand: [0, 0, 0] }, approval: { ...DRAFT } };
/** Engineering rehearsal only. These orders and placeholder questions are not an approved study. */
export function demoPlan(): Plan {
  const clip = (id: string, kind: ClipManifest['kind']): ClipManifest => ({ schema: 'punchcap-clip-v1', id, takeId: id, actorId: 'reference-actor', kind, durationMs: 12000, model: structuredClone(REFERENCE_MAPPING), source: 'synthetic', interrupted: false,
    files: { motion: { name: 'motion.json', sha256: '0'.repeat(64) }, audio: { name: 'audio.wav', sha256: '0'.repeat(64), sampleRate: 48000, frames: 576000 } },
    cues: kind === 'main' ? [{ id: 'window', atMs: 2000, endMs: 8000, kind: 'response-window', anchor: 'stage', offset: [0, 0, 0], assetId: '', throwable: false }] : [],
    approval: { ...DRAFT }, sync: { status: 'unmeasured', offsetMs: 0, uncertaintyMs: null, method: '', approval: { ...DRAFT } } });
  const orders = [['A', 'B', 'D', 'C'], ['B', 'C', 'A', 'D'], ['C', 'D', 'B', 'A'], ['D', 'A', 'C', 'B']] as const;
  return validatePlan({ schema: 'punchcap-plan-v1', id: 'engineering-rehearsal', version: 'v1', approval: { ...DRAFT }, allocation: { strategy: 'williams', basis: '工程预演样例，研究者未确认', approval: { ...DRAFT } }, matching: { threshold: null, scores: {}, basis: '', approval: { ...DRAFT } },
    assignments: orders.map((order, row) => ({ participantId: `DEMO${row + 1}`, rounds: order.map((condition, column) => ({ condition, groupId: `group${(column + row) % 4 + 1}`, clipId: `main${(column + row) % 4 + 1}` })) })),
    clips: [clip('practice', 'practice'), ...[1, 2, 3, 4].map(i => clip(`main${i}`, 'main')), clip('response', 'response')], practiceClipId: 'practice', responses: Object.fromEntries([1, 2, 3, 4].map(i => [`main${i}`, ['response']])),
    questionnaires: ['pre', 'round', 'post'].map(timing => ({ id: `placeholder-${timing}`, version: 'draft', timing, questions: [{ id: 'placeholder', prompt: '工程预演确认（不是研究问卷）', options: ['待检查', '已检查'], required: true }], approval: { ...DRAFT } })) });
}
