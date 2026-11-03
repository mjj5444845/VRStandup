import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, validateSession } from './session';
import { engineeringClip, engineeringPlan, engineeringSession } from './engineering';
import { applyEvidence, contextKey, mediaContext, validateEvidence, validateExecution, type Evidence } from './execution';
import { actorPoint, add, advanceFlight, distance, gazeAngle, onStage, releaseVelocity, stretchScale, theatreSeats } from './theatre';
import { parseRequest } from './protocol';
test('integrated practice and four rounds require real media and versioned answers, including response resume', () => {
  let s = engineeringSession(), now = 100;
  const act = (kind: Parameters<typeof applyAction>[1]['kind'], value?: string) => { s = applyAction(s, { kind, value, sessionId: s.id, expectedVersion: s.version }, 'operator', now++); };
  const capture = (e: Evidence) => { s = applyEvidence(s, e, now++); validateSession(s); };
  const answers = () => { const timing = s.stage === 'pre-questionnaire' ? 'pre' : s.stage === 'post-questionnaire' ? 'post' : 'round', q = s.plan.questionnaires.find(q => q.timing === timing)!; capture({ kind: 'answers', questionnaireId: q.id, version: q.version, round: s.roundIndex, answers: q.timing === 'round' ? { 'demo-rating': 5 } : { placeholder: 1 } }); };
  const finish = () => capture({ kind: 'media', context: mediaContext(s)!, positionMs: 12000, ended: true });
  assert.throws(() => applyAction(s, { kind: 'preDone', sessionId: s.id, expectedVersion: s.version }, 'participant', now));
  assert.equal(mediaContext(s), null); answers(); assert.equal(s.stage, 'practice'); finish();
  for (let i = 0; i < 4; i++) {
    act('advance'); const c = mediaContext(s)!;
    capture({ kind: 'media', context: c, positionMs: 5000, ended: false });
    capture({ kind: 'orientation', context: c, samples: [{ elapsedMs: 1, mediaMs: 5000, source: 'desktop', head: { position: [0, 1.7, 2], orientation: [0, 0, 0, 1] }, actorHead: [0, 2, -3] }, { elapsedMs: 2, mediaMs: 5001, source: 'xr', head: null, actorHead: null }] });
    const condition = s.plan.assignments[0].rounds[i].condition;
    if (condition !== 'A') {
      const kind = condition === 'B' ? 'expressive' : 'distancing', atMs = kind === 'expressive' ? 1000 : 5000;
      for (const action of ['show', 'grab', 'stretch', 'release', 'hide'] as const) capture({ kind: 'interaction', context: c, cueId: kind, atMs, action, target: 'self', scale: 1, position: [0, 1, 0] });
      if (condition === 'D') {
        for (const action of ['attach', 'throw', 'land'] as const) capture({ kind: 'interaction', context: c, cueId: kind, atMs: 5000, action, target: 'self', scale: 1, position: [0, 0, 0], outcome: 'floor' });
        act('respond', 'club-flow-response'); assert.equal(s.execution!.responseMs, 0); assert.equal(mediaContext(s)!.phase, 'response');
        capture({ kind: 'media', context: mediaContext(s)!, positionMs: 2000, ended: false }); finish(); assert.equal(s.positionMs, 5000);
      }
    }
    capture({ kind: 'interruption', reason: 'test pause' }); assert.equal(s.stage, 'paused'); assert.equal(mediaContext(s)!.phase, 'main');
    capture({ kind: 'interruption', reason: 'already paused' }); act('resume'); finish(); answers();
    if (i !== 3) act('advance');
  }
  answers(); assert.equal(s.stage, 'completed'); assert.equal(s.execution!.answers.length, 6);
  assert.throws(() => applyEvidence(s, { kind: 'interruption', reason: 'late' }, now));
  assert.ok(engineeringClip('club-flow-main1').take.frames.length); assert.throws(() => engineeringClip('unknown')); assert.equal(engineeringPlan().clips.length, 6);
});
test('capture validation rejects wrong phases, lost readiness, corrupt poses and condition bypasses', () => {
  const s = engineeringSession(); assert.equal(validateExecution(s.execution).kind, 'integrated'); assert.throws(() => validateExecution({}));
  assert.throws(() => applyEvidence({ ...s, connected: false }, { kind: 'interruption', reason: 'x' }, 1));
  assert.throws(() => applyEvidence(s, { kind: 'answers', questionnaireId: 'missing', version: 'draft', round: 0, answers: {} }, 1));
  const practice = { ...s, stage: 'practice' as const }, context = mediaContext(practice)!;
  assert.equal(contextKey(context), '0:practice:club-flow-practice:0');
  for (const positionMs of [-1, 13000]) assert.throws(() => applyEvidence(practice, { kind: 'media', context, positionMs, ended: true }, 1));
  assert.throws(() => applyEvidence(practice, { kind: 'media', context, positionMs: 2, ended: true }, 1));
  assert.throws(() => applyEvidence(practice, { kind: 'media', context: { ...context, round: 2 }, positionMs: 2, ended: false }, 1));
  const o = { kind: 'orientation', context, samples: [{ elapsedMs: 1, mediaMs: 0, head: null, actorHead: null, source: 'xr' }] };
  assert.ok(validateEvidence(o));
  for (const value of [null, {}, { kind: 'answers' }, { kind: 'interruption', reason: '' }, { kind: 'media' }, { ...o, samples: [] }, { ...o, samples: [{ ...o.samples[0], head: {} }] }, { ...o, samples: [o.samples[0], o.samples[0]] }, { kind: 'unknown', context }, { kind: 'interaction', context }]) assert.throws(() => validateEvidence(value));
  assert.throws(() => applyEvidence(practice, { ...o, samples: [{ ...o.samples[0], mediaMs: 13000 }] }, 1));
  const main = { ...s, stage: 'playing' as const }, c = mediaContext(main)!, interaction = { kind: 'interaction', context: c, cueId: 'distancing', atMs: 5000, action: 'grab', target: 'self', scale: 1, position: [0, 1, 0] };
  assert.throws(() => applyEvidence(main, interaction, 1));
  const b = { ...main, roundIndex: 1 }, bc = mediaContext(b)!;
  assert.throws(() => applyEvidence(b, { ...interaction, context: bc, cueId: 'expressive', atMs: 1000, action: 'throw' }, 1));
  assert.throws(() => applyEvidence(b, { ...interaction, context: bc, cueId: 'expressive', atMs: 3000 }, 1));
  assert.throws(() => applyEvidence(b, { ...interaction, context: bc, cueId: 'expressive', atMs: 1000, action: 'attach' }, 1));
  assert.throws(() => applyEvidence(b, { ...interaction, context: bc, cueId: 'missing' }, 1));
  const req = { v: 1, type: 'command', id: 'capture', clientTimeMs: 1, command: { kind: 'capture', sessionId: s.id, evidence: { kind: 'interruption', reason: 'x' } } }; assert.ok(parseRequest(req)); assert.throws(() => parseRequest({ ...req, command: { ...req.command, extra: true } }));
});
test('substitute layout, gaze, stretching and ballistic collisions have bounded deterministic geometry', () => {
  const seats = theatreSeats(); assert.equal(seats.length, 24); assert.equal(new Set(seats.map(s => s.position.join(','))).size, 24);
  assert.deepEqual(add([1, 2, 3], [4, 5, 6]), [5, 7, 9]); assert.equal(distance([0, 0, 0], [3, 4, 0]), 5); assert.equal(actorPoint([0, 0, 0])[1], .36);
  assert.equal(gazeAngle(null, null), null); const head = { position: [0, 0, 0] as const, orientation: [0, 0, 0, 1] as const };
  assert.equal(gazeAngle(head, [0, 0, -1]), 0); assert.equal(gazeAngle(head, [0, 0, 1]), 180); assert.equal(gazeAngle(head, [0, 0, 0]), null);
  assert.equal(stretchScale(1, 1, 100), 2.5); assert.equal(stretchScale(1, 1, 0), .5); assert.equal(stretchScale(1, 2, 3), 1.5); assert.throws(() => stretchScale(1, 0, 2));
  assert.ok(Math.hypot(...releaseVelocity([0, 0, 0], [100, 0, 0], 1)) <= 12); assert.deepEqual(releaseVelocity([0, 0, 0], [0, 0, 0], 10), [0, 0, 0]); assert.throws(() => releaseVelocity([0, 0, 0], [0, 0, 0], 0));
  assert.ok(onStage([0, 0, -3.78])); assert.ok(!onStage([4, 0, 0]));
  assert.equal(advanceFlight({ position: [0, .37, -3.78], velocity: [0, -1, 0], landed: null }, .1).landed, 'stage');
  assert.equal(advanceFlight({ position: [0, .01, 0], velocity: [0, -1, 0], landed: null }, .1).landed, 'floor');
  assert.equal(advanceFlight({ position: [5.1, 2, 0], velocity: [10, 0, 0], landed: null }, .1).landed, 'outside');
  const resting = { position: [0, 0, 0] as const, velocity: [0, 0, 0] as const, landed: 'floor' as const }; assert.equal(advanceFlight(resting, .1), resting);
  assert.equal(advanceFlight({ ...resting, position: [0, 2, 0], landed: null }, .1).landed, null); assert.throws(() => advanceFlight(resting, 1));
});
