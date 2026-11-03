import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoPlan, REFERENCE_MAPPING } from './demo';
import { DRAFT, compatibleResponse, studyMaterialIssues, validateApproval, validateCues, validateManifest, validateMapping, type Cue } from './materials';
import { INITIAL_TRANSPORT, interpolateOrientation, pauseStalledTransport, pauseTransport, startTransport, transportTime } from './motion';
import { allocationIssues, studyPlanIssues, validateAnswers, validatePlan } from './plan';
import { estimateClock, parseHello, parseRequest } from './protocol';
import { applyAction, connectionChanged, createSession, currentRound, validateSession, type Action, type Session } from './session';
import { crossedCues, orderedCues, visibleCues } from './timeline';
import { date, exact, finite, id, object, text, tuple } from './validation';
import { canonicalJson } from './validation';
import { syntheticTake } from './synthetic-take';
import { readRecording } from './recording';
const approval = { status: 'approved', reviewer: 'REVIEWER', reviewedAt: '2026-11-03T12:00:00Z', basis: 'unit-test-only' } as const;
function action(s: Session, kind: Action['kind'], role: 'operator' | 'participant' = 'operator', value?: string | number) { return applyAction(s, { kind, sessionId: s.id, expectedVersion: s.version, ...(value === undefined ? {} : { value }) }, role, s.updatedAt + 1); }
test('validators reject paths, inherited keys, NaN and ambiguous approval', () => {
  assert.ok(object({})); assert.equal(object([]), false); assert.equal(id('../escape'), false); assert.equal(id('a'.repeat(81)), false); assert.equal(finite(NaN), false);
  assert.equal(text(''), false); assert.equal(date('bad'), false); assert.equal(tuple([1, NaN], 2), false); assert.equal(exact({ extra: true }, ['ok']), false);
  assert.throws(() => validateApproval({ ...approval, reviewer: '' })); assert.deepEqual(validateApproval(DRAFT), DRAFT); assert.throws(() => validateApproval(null));
  assert.equal(canonicalJson({ b: [1, null], a: 'x' }), canonicalJson({ a: 'x', b: [1, null] }));
});
test('engineering fixture and old recording conversion keep explicit duration limits', () => {
  const t = syntheticTake(); assert.equal(t.source, 'test-fixture'); assert.equal(t.frames.length, 1201);
  assert.equal(readRecording(t).captureLimitMs, 180000);
  const old = { ...t, schema: 'punchcap-recording-check-v1', captureLimitMs: undefined }; assert.equal(readRecording(old).captureLimitMs, 15000);
  assert.throws(() => readRecording({ ...old, durationMs: 16000 }));
});
test('motion keeps quaternion short arcs, audio transport and interruption position', () => {
  assert.deepEqual(interpolateOrientation([0, 0, 0, 1], [0, 0, 0, -1], .5), [0, 0, 0, 1]);
  assert.ok(Math.abs(interpolateOrientation([0, 0, 0, 1], [0, 1, 0, 0], .5)[1] - Math.SQRT1_2) < 1e-10);
  const p = startTransport(INITIAL_TRANSPORT, 1, 1000); assert.equal(transportTime(p, 1.5, 1000), 500);
  assert.equal(pauseTransport(p, 2, 1000).phase, 'ended'); assert.equal(pauseTransport(p, 1.2, 1000).phase, 'paused');
  assert.equal(startTransport({ ...p, offsetMs: 1000 }, 3, 1000).offsetMs, 0);
  assert.equal(pauseStalledTransport(p, 100, 400, 1000)?.offsetMs, 100); assert.equal(pauseStalledTransport(p, 100, 200, 1000), null);
  assert.throws(() => transportTime(p, NaN, 1000)); assert.throws(() => pauseStalledTransport(p, 400, 100, 1000));
});
test('cue validation preserves stable ties, half-open intervals and study caption rules', () => {
  const base: Cue = { id: 'laugh', atMs: 1000, endMs: 1500, kind: 'laugh', anchor: 'stage', offset: [0, 0, 0], assetId: '', throwable: false };
  const cues = [base, { ...base, id: 'caption', atMs: 1500, endMs: 2000, kind: 'distancing' as const }, { ...base, id: 'same', kind: 'response-window' as const }];
  validateCues(cues, 4000); assert.deepEqual(orderedCues(cues).map(c => c.id), ['laugh', 'same', 'caption']);
  assert.equal(crossedCues(cues, 999, 1500, 'A').length, 2); assert.equal(visibleCues(cues, 1500, 'C').length, 1); assert.equal(visibleCues(cues, 2000, 'C').length, 0);
  assert.throws(() => crossedCues(cues, 100, 99, 'B'));
  assert.throws(() => validateCues([{ ...base, kind: 'expressive', throwable: true }], 4000));
  assert.throws(() => validateCues([{ ...base, kind: 'distancing' }], 4000));
  assert.throws(() => validateCues([{ ...base, kind: 'expressive', endMs: 7000 }], 8000));
  assert.throws(() => validateCues([{ ...base, kind: 'pause' }, { ...base, id: 'cap', kind: 'expressive' }], 4000));
  assert.throws(() => validateCues([1, 2, 3].map(i => ({ ...base, id: `c${i}`, kind: 'expressive' })), 4000));
});
test('material checks gate research, response identity and exact file duration', () => {
  const p = demoPlan(), main = p.clips[1], response = p.clips.at(-1)!; assert.equal(compatibleResponse(main, response), true);
  assert.equal(compatibleResponse(main, { ...response, actorId: 'other' }), false); assert.ok(studyMaterialIssues(main).length >= 3);
  assert.throws(() => validateMapping({ ...REFERENCE_MAPPING, nodes: { head: 'same', leftHand: 'same', rightHand: 'same' } }));
  assert.throws(() => validateMapping(null)); assert.throws(() => validateManifest({ ...main, files: { ...main.files, audio: { ...main.files.audio, frames: 1 } } }));
  assert.throws(() => validateManifest({ ...main, sync: { ...main.sync, status: 'measured' } }));
  const measured = { ...main, source: 'device' as const, approval, model: { ...main.model, approval }, sync: { status: 'measured' as const, offsetMs: 0, uncertaintyMs: 1, method: 'test-only', approval } };
  assert.deepEqual(studyMaterialIssues(validateManifest(measured)), []); assert.ok(studyMaterialIssues({ ...measured, interrupted: true }).length);
});
test('plan import rejects missing mappings, duplicate people and invented approvals', () => {
  const p = demoPlan(); assert.ok(studyPlanIssues(p).length); assert.throws(() => validatePlan({ ...p, assignments: [...p.assignments, p.assignments[0]] }));
  const bad = structuredClone(p); bad.assignments[0].rounds[1].condition = bad.assignments[0].rounds[0].condition; assert.throws(() => validatePlan(bad));
  assert.throws(() => validatePlan({ ...p, responses: { main1: ['practice'] } })); assert.throws(() => validatePlan({ ...p, practiceClipId: 'missing' }));
  const q = p.questionnaires[0]; assert.deepEqual(validateAnswers(q, { placeholder: 1 }), { placeholder: 1 }); assert.throws(() => validateAnswers(q, {})); assert.throws(() => validateAnswers(q, { unknown: 1 }));
  assert.throws(() => validateAnswers(q, { placeholder: 2 })); assert.deepEqual(validateAnswers({ ...q, questions: [{ ...q.questions[0], required: false }] }, {}), {});
  const b = structuredClone(p); b.questionnaires[0].questions[0].options = ['same', 'same']; assert.throws(() => validatePlan(b));
  const typed = structuredClone(p); typed.questionnaires[0].questions = [{ id: 'n', kind: 'number', prompt: 'unit number', min: 1, max: 3, required: true }, { id: 't', kind: 'text', prompt: 'unit text', maxLength: 12, required: true }];
  validatePlan(typed); assert.deepEqual(validateAnswers(typed.questionnaires[0], { n: 2, t: 'ok' }), { n: 2, t: 'ok' });
  assert.throws(() => validateAnswers(typed.questionnaires[0], { n: 4, t: '' })); assert.throws(() => validateAnswers(typed.questionnaires[0], { n: 2, t: '' }));
  assert.ok(allocationIssues(p.assignments.slice(0, 1)).length); assert.ok(allocationIssues(p.assignments).some(x => x.includes('段子组')));
  const balanced = Array.from({ length: 16 }, (_, i) => ({ participantId: `TEST${i}`, rounds: p.assignments[i % 4].rounds.map((r, column) => ({ ...r, groupId: `group${(column + Math.floor(i / 4)) % 4 + 1}` })) }));
  assert.deepEqual(allocationIssues(balanced), []);
});
test('approved configurations are accepted only after all explicit research gates pass', () => {
  const p = demoPlan(); p.approval = approval; p.allocation = { strategy: 'custom', basis: 'approved custom design for unit test', approval };
  p.matching = { threshold: 0, scores: { group1: 5, group2: 5, group3: 5, group4: 5 }, basis: 'unit-test criterion, not study', approval };
  p.questionnaires.forEach(q => q.approval = approval); p.clips.forEach(c => { c.source = 'device'; c.approval = approval; c.model.approval = approval; c.sync = { status: 'measured', offsetMs: 0, uncertaintyMs: 1, method: 'unit test', approval }; });
  assert.deepEqual(studyPlanIssues(validatePlan(p)), []); assert.equal(createSession('S1', 'DEMO1', p, 'study', 1).mode, 'study');
  p.matching.scores.group4 = 9; assert.ok(studyPlanIssues(p).some(x => x.includes('差异')));
});
test('protocol fails closed on extra fields, unsafe identities and invalid timing', () => {
  assert.equal(parseHello({ v: 1, type: 'hello', role: 'operator', clientId: 'client', key: 'secret' }).role, 'operator');
  for (const x of [null, { v: 2 }, { v: 1, type: 'hello', role: 'participant', clientId: 'c', key: 'k' }]) assert.throws(() => parseHello(x));
  const request = { v: 1, type: 'command', id: 'r1', clientTimeMs: 1, command: { kind: 'advance', sessionId: 'S1', expectedVersion: 0 } };
  assert.equal(parseRequest(request).id, 'r1'); assert.throws(() => parseRequest({ ...request, admin: true })); assert.throws(() => parseRequest({ ...request, command: { ...request.command, kind: 'hack' } }));
  parseRequest({ ...request, command: { kind: 'create', sessionId: 'S1', participantId: 'DEMO1', mode: 'rehearsal', plan: demoPlan() }, clock: { offsetMs: 2, rttMs: 5 } });
  assert.throws(() => parseRequest({ ...request, clock: { offsetMs: 2, rttMs: -1 } }));
  assert.deepEqual(estimateClock(0, 15, 16, 11), { offsetMs: 10, rttMs: 10, uncertaintyMs: 5 }); assert.throws(() => estimateClock(10, 1, 0, 0)); assert.throws(() => estimateClock(0, 100, 200, 10));
});
test('full four-round flow, pause, disconnect, stale version and terminal abort are enforced', () => {
  let s = createSession('S1', 'DEMO1', demoPlan(), 'rehearsal', 1);
  assert.throws(() => createSession('S1', 'DEMO1', demoPlan(), 'study', 1)); assert.throws(() => action(s, 'advance'));
  s = connectionChanged(s, true, 2); s = action(s, 'ready', 'participant'); s = action(s, 'advance'); s = action(s, 'advance'); s = action(s, 'preDone', 'participant');
  s = action(s, 'practiceDone', 'participant');
  for (let i = 0; i < 4; i++) {
    s = action(s, 'advance'); const old = s; s = action(s, 'progress', 'participant', 2500);
    assert.throws(() => applyAction(s, { kind: 'pause', sessionId: s.id, expectedVersion: old.version }, 'operator', 100));
    s = connectionChanged(s, false, 3); assert.equal(s.stage, 'paused'); assert.equal(connectionChanged(s, false, 3), s); assert.throws(() => action(s, 'resume'));
    s = connectionChanged(s, true, 4); s = action(s, 'ready', 'participant'); s = action(s, 'resume');
    if (currentRound(s).condition === 'D') { s = action(s, 'respond', 'operator', 'response'); assert.equal(s.positionMs, 2500); s = action(s, 'responseDone', 'participant'); }
    else assert.throws(() => action(s, 'respond', 'operator', 'response'));
    s = action(s, 'pause'); s = action(s, 'resume'); s = action(s, 'roundDone', 'participant'); s = action(s, 'surveyDone', 'participant');
    if (i < 3) s = action(s, 'advance');
  }
  s = action(s, 'postDone', 'participant'); assert.equal(validateSession(JSON.parse(JSON.stringify(s))).stage, 'completed'); assert.throws(() => action(s, 'advance'));
  assert.equal(action(s, 'note', 'operator', 'terminal note'), s);
  const initial = createSession('S2', 'DEMO2', demoPlan(), 'rehearsal', 1); assert.equal(action(initial, 'abort', 'operator', 'test cancellation').stage, 'aborted');
  assert.throws(() => action(initial, 'advance', 'participant')); assert.throws(() => validateSession({}));
  assert.equal(action(initial, 'resetParticipant').stage, 'paused');
});
test('D responses preserve main progress and enforce explicit windows and the two-response cap', () => {
  let s = connectionChanged(createSession('D1', 'DEMO4', demoPlan(), 'rehearsal', 1), true, 2);
  s = action(s, 'ready', 'participant'); s = action(s, 'advance'); s = action(s, 'advance'); s = action(s, 'preDone', 'participant'); s = action(s, 'practiceDone', 'participant'); s = action(s, 'advance');
  assert.throws(() => action(s, 'respond', 'operator', 'response')); s = action(s, 'progress', 'participant', 2500);
  assert.throws(() => action(s, 'respond', 'operator', 'unknown'));
  for (let i = 0; i < 2; i++) { s = action(s, 'respond', 'operator', 'response'); assert.throws(() => action(s, 'roundDone', 'participant')); s = action(s, 'responseDone', 'participant'); assert.equal(s.positionMs, 2500); }
  assert.throws(() => action(s, 'respond', 'operator', 'response')); assert.equal(s.responseCount, 2);
});
