import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEVICE_STEPS, deviceClip, deviceObservations, deviceReport, deviceRequirements, observeDevice, orientationDistance, validateDeviceReport, type DeviceDecision, type DeviceStep } from './device-test';
import { desktopView } from './desktop-view';
import { initialSceneInfo } from './scene-interface';
import { validateEvidence } from './execution';
import { validateManifest } from './materials';
import { fixedSeatRig } from './viewer';
test('desktop actions cannot pass hardware checks; actual XR evidence and operator decisions are both required', () => {
  const empty = deviceObservations(), context = { phase: 'practice' as const, round: 0, clipId: 'test', response: 0 }, interaction = { kind: 'interaction' as const, context, cueId: 'test', atMs: 100, action: 'grab' as const, target: 'self' as const, scale: 1, position: [0, 1, 0] as const, source: 'desktop' as const };
  assert.equal(observeDevice(empty, interaction).grabs, 0); assert.equal(observeDevice(empty, { kind: 'performance', context, frames: 100, elapsedMs: 1000, refreshHz: 90, source: 'desktop' }).xrFrames, 0);
  let s = observeDevice(empty, { ...interaction, source: 'xr' }); s = observeDevice(s, { ...interaction, source: 'xr', action: 'stretch', inputCount: 1 }); assert.equal(s.twoHandStretches, 0);
  s = observeDevice(s, { ...interaction, source: 'xr', action: 'stretch', inputCount: 2 }); s = observeDevice(s, { ...interaction, source: 'xr', action: 'attach' }); s = observeDevice(s, { ...interaction, source: 'xr', action: 'throw' }); s = observeDevice(s, { ...interaction, source: 'xr', action: 'land', outcome: 'stage' });
  assert.equal(s.grabs, 1); assert.equal(s.twoHandStretches, 1); assert.equal(s.attaches, 1); assert.equal(s.throws, 1); assert.equal(s.stageLands, 1);
  s = observeDevice(s, { kind: 'orientation', context, samples: [{ elapsedMs: 0, mediaMs: 0, source: 'xr', head: null, actorHead: null }, { elapsedMs: 1, mediaMs: 1, source: 'xr', head: { position: [0, 1, 0], orientation: [0, 0, 0, 1] }, actorHead: null }] }); assert.equal(s.xrHeadSamples, 1);
  s = observeDevice(s, { kind: 'performance', context, frames: 900, elapsedMs: 10000, refreshHz: 90, source: 'xr' }); assert.ok(deviceRequirements('performance', s)); assert.equal(deviceRequirements('performance', { ...s, xrFrames: 500 }), false); assert.equal(deviceRequirements('performance', { ...s, refreshHz: null }), false);
  for (const step of DEVICE_STEPS) assert.equal(deviceRequirements(step.id, empty), false);
  const full = { ...s, assets: 'pass' as const, xrEntries: 2, xrExits: 2, xrHeadSamples: 10, headTurnDegrees: 30, leftInput: true, rightInput: true, conditions: ['A', 'B', 'C', 'D'] as ('A'|'B'|'C'|'D')[], throws: 3, stageLands: 3, responses: 2, blockedThird: 1, answers: 1, systemInterruptions: 1, resumes: 1, audioSegments: 1 };
  for (const step of DEVICE_STEPS) assert.ok(deviceRequirements(step.id, full), step.id);
  const decisions = Object.fromEntries(DEVICE_STEPS.map(step => [step.id, { status: 'pass', note: '操作者确认' }])) as Record<DeviceStep, DeviceDecision>;
  assert.equal(deviceReport(full, {}).complete, false); assert.equal(deviceReport(full, decisions).complete, true); assert.equal(deviceReport(empty, decisions).complete, false);
  assert.equal(validateDeviceReport(deviceReport(full, decisions)).complete, true); assert.equal(validateDeviceReport({ ...deviceReport(empty, decisions), complete: true }).complete, false);
  assert.ok(deviceReport(empty, {}).warnings.length); assert.equal(deviceReport(full, {}).warnings.length, 0);
  const report = deviceReport(full, { ...decisions, assets: { status: 'skipped', note: '待测' } }); assert.equal(validateDeviceReport(report).complete, false);
  for (const bad of [null, {}, { ...report, checks: [] }, { ...report, observations: { ...full, xrFrames: -1 } }, { ...report, observations: { ...full, conditions: ['A', 'A'] } }, { ...report, observations: { ...full, leftInput: 1 } }, { ...report, observations: { ...full, assets: 'unknown' } }, { ...report, checks: report.checks.map(c => ({ ...c, note: 1 })) }]) assert.throws(() => validateDeviceReport(bad));
  assert.ok(validateEvidence({ ...interaction, inputCount: 2 })); assert.throws(() => validateEvidence({ ...interaction, inputCount: 3 })); assert.throws(() => validateEvidence({ ...interaction, source: 'pretend-xr' }));
});
test('device exercises use long deterministic windows and desktop look cannot alter headset tracking', () => {
  const clip = deviceClip('response', 'D'); assert.equal(clip.take.durationMs, 60000); assert.equal(clip.take.frames.length, 6001); assert.equal(clip.take.audio.sampleRate, 8000); assert.equal(validateManifest(clip.manifest).source, 'synthetic'); assert.equal(deviceClip('assets').manifest.id, 'device-assets-D'); assert.throws(() => deviceClip('../invalid'));
  assert.equal(initialSceneInfo().immersive, false); assert.deepEqual(desktopView(0, 0, 100, 100), { yaw: -.4, pitch: -.4 }); assert.equal(desktopView(0, 0, 0, 10000).pitch, -1.2); assert.equal(desktopView(0, 0, 0, -10000).pitch, 1.2); assert.throws(() => desktopView(NaN, 0, 0, 0));
  assert.equal(orientationDistance([0, 0, 0, 1], [0, 0, 0, -1]), 0); assert.ok(Math.abs(orientationDistance([0, 0, 0, 1], [0, Math.sin(Math.PI/12), 0, Math.cos(Math.PI/12)]) - 30) < 1e-6);
});
test('initial XR reference pose aligns to the selected seat without changing measured eye height', () => {
  const head = { position: [2, 1.27, -3] as const, orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const }, seat = [-1.55, 0, -.59] as const, rig = fixedSeatRig(head, seat)!;
  const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw); assert.ok(Math.abs(rig.position[0] + c * 2 + s * -3 - seat[0]) < 1e-6); assert.ok(Math.abs(rig.position[2] - s * 2 + c * -3 - seat[2]) < 1e-6); assert.equal(rig.position[1] + head.position[1], 1.27);
  const worldForward = [-c, s], direction = [0 - seat[0], -3.78 - seat[2]], error = Math.hypot(worldForward[0] - direction[0] / Math.hypot(...direction), worldForward[1] - direction[1] / Math.hypot(...direction)); assert.ok(error < 1e-6);
  assert.equal(fixedSeatRig({ ...head, orientation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] }, seat), null); assert.throws(() => fixedSeatRig({ ...head, position: [NaN, 1, 2] }, seat));
});
