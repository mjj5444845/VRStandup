import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditExecution, csvCell } from './audit';
import { validateAudioUpload, validateMeasurementAudio, type MeasurementAudio } from './measurement';
import { applyEvidence, mediaContext, type Evidence } from './execution';
import { applyAction } from './session';
import { engineeringSession } from './engineering';
const upload = { schema: 'punchcap-measurement-audio-v1', id: 'segment', sessionId: 'LOCAL-DEMO', participantId: 'DEMO1', round: 0, clipId: 'flow-main1', mime: 'audio/wav', source: 'synthetic-test', startedAt: '2026-11-03T00:00:00Z', stoppedAt: '2026-11-03T00:00:01Z', reason: 'test', markers: [{ elapsedMs: 0, context: { round: 0, clipId: 'flow-main1', phase: 'main', response: 0 }, mediaMs: 0 }] };
test('measurement records keep explicit identity, clocks, container, bounds and source', () => {
  assert.equal(validateAudioUpload(upload).id, 'segment'); const m = { ...upload, bytes: 100, sha256: '1'.repeat(64) }; assert.equal(validateMeasurementAudio(m).bytes, 100);
  for (const bad of [{}, { ...upload, mime: 'text/html' }, { ...upload, stoppedAt: '2025-01-01' }, { ...upload, markers: [] }, { ...upload, markers: [{ ...upload.markers[0], elapsedMs: -5 }] }, { ...upload, markers: [{ ...upload.markers[0], context: {} }] }]) assert.throws(() => validateAudioUpload(bad));
  assert.throws(() => validateMeasurementAudio({ ...m, bytes: 0 })); assert.throws(() => validateMeasurementAudio({ ...m, sha256: 'bad' }));
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"'); assert.equal(csvCell('normal"text'), '"normal""text"'); assert.equal(csvCell(null), '""');
});
test('integrity report finds missing data and distinguishes complete engineering data from research evidence', () => {
  let s = engineeringSession(); const events: unknown[] = [null, { type: 'unrelated' }], audio: MeasurementAudio[] = [];
  const capture = (e: Evidence) => { s = applyEvidence(s, e, Date.now()); events.push({ type: 'command', accepted: true, command: { kind: 'capture', evidence: e } }); };
  const answer = () => { const timing = s.stage === 'pre-questionnaire' ? 'pre' : s.stage === 'post-questionnaire' ? 'post' : 'round', q = s.plan.questionnaires.find(q => q.timing === timing)!; capture({ kind: 'answers', questionnaireId: q.id, version: q.version, round: s.roundIndex, answers: timing === 'round' ? { 'demo-rating': 3 } : { placeholder: 1 } }); };
  const finish = () => capture({ kind: 'media', context: mediaContext(s)!, positionMs: 12000, ended: true });
  const advance = () => { s = applyAction(s, { kind: 'advance', sessionId: s.id, expectedVersion: s.version }, 'operator', Date.now()); };
  assert.equal(auditExecution(s, events).complete, false); answer(); finish();
  for (let i = 0; i < 4; i++) {
    advance(); const context = mediaContext(s)!;
    capture({ kind: 'media', context, positionMs: 5000, ended: false });
    capture({ kind: 'orientation', context, samples: [{ elapsedMs: 1, mediaMs: 5000, source: 'desktop', head: { position: [0, 1, 1], orientation: [0, 0, 0, 1] }, actorHead: [0, 1, -3] }, { elapsedMs: 2, mediaMs: 5001, source: 'xr', head: null, actorHead: null }] });
    capture({ kind: 'performance', context, frames: 60, elapsedMs: 1000, refreshHz: i ? 72 : null, source: i ? 'xr' : 'desktop' });
    assert.throws(() => applyEvidence(s, { kind: 'performance', context, frames: 0, elapsedMs: 0, refreshHz: -1, source: 'bad' }, Date.now()));
    if (i === 2) {
      const land = { kind: 'interaction', context, cueId: 'distancing', atMs: 5000, action: 'land', target: 'self', scale: 1, position: [0, .36, -3.78], outcome: 'stage' } as const;
      assert.throws(() => applyEvidence(s, { ...land, position: [10, .36, -3] }, Date.now()));
      capture(land); assert.equal(s.stage, 'responding'); finish(); assert.equal(s.stage, 'playing');
    }
    capture({ kind: 'interruption', reason: 'audited pause' }); s = applyAction(s, { kind: 'resume', sessionId: s.id, expectedVersion: s.version }, 'operator', Date.now()); finish();
    audio.push(validateMeasurementAudio({ ...upload, id: `audio-${i}`, round: i, clipId: context.clipId, bytes: 100, sha256: '1'.repeat(64), markers: [{ ...upload.markers[0], context }] })); answer(); if (i < 3) advance();
  }
  answer(); const result = auditExecution(s, events, audio); assert.equal(result.complete, true); assert.equal(result.rounds[0].meanAngleDegrees, 0); assert.ok(result.warnings.some(w => w.includes('90%'))); assert.ok(result.warnings.some(w => w.includes('合成')));
  assert.equal(auditExecution({ ...s, execution: undefined }, []).complete, false);
  assert.equal(auditExecution({ ...s, execution: { ...s.execution!, audioRequired: true } }, events).complete, false);
  const noOrientations = events.filter(e => !(e && typeof e === 'object' && 'command' in e && JSON.stringify(e).includes('orientation'))); assert.equal(auditExecution(s, noOrientations).complete, false);
  const missingOnly = events.map(e => JSON.stringify(e).includes('orientation') ? { type: 'command', accepted: true, command: { kind: 'capture', evidence: { kind: 'orientation', context: { round: 0, phase: 'main', clipId: 'flow-main1', response: 0 }, samples: [{ elapsedMs: 1, mediaMs: 1, source: 'xr', head: null, actorHead: null }] } } } : e);
  assert.equal(auditExecution(s, missingOnly).rounds[0].meanAngleDegrees, null);
});
