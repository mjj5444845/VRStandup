import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMeasurementRecorder } from './measurement-audio';
test('measurement recording keeps segments and timing markers until explicit durable confirmation', async () => {
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), mr = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder'); let stopped = 0, trackState = 'live';
  const track = { get readyState() { return trackState; }, onended: null, stop() { stopped++; trackState = 'ended'; } }, stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Recorder {
    state = 'inactive'; onstop: (() => void) | null = null; onerror: (() => void) | null = null; ondataavailable: ((event: { data: Blob }) => void) | null = null;
    static isTypeSupported() { return true; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array([26, 69, 223, 163, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]) }); this.onstop?.(); }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } }); Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  try {
    const completed: string[] = [], recorder = createMeasurementRecorder(() => {}, segment => completed.push(segment.metadata.id)), context = { round: 0, phase: 'main' as const, clipId: 'main', response: 0 };
    assert.equal(recorder.begin({ sessionId: 's', participantId: 'p', round: 0, clipId: 'main' }, { elapsedMs: 0, context, mediaMs: 0 }), false);
    await recorder.prepare(); assert.ok(recorder.available()); assert.ok(recorder.begin({ sessionId: 's', participantId: 'p', round: 0, clipId: 'main' }, { elapsedMs: 0, context, mediaMs: 0 }));
    assert.ok(recorder.recording()); await assert.rejects(recorder.prepare()); recorder.mark({ elapsedMs: 0, context, mediaMs: 1000 }); recorder.stop('test-boundary');
    assert.equal(completed.length, 1); assert.equal(recorder.pending()[0].metadata.markers.length, 2); assert.equal(recorder.pending()[0].metadata.reason, 'test-boundary');
    recorder.confirmed(completed[0]); assert.equal(recorder.pending().length, 0); recorder.close(); assert.equal(stopped, 1); assert.equal(recorder.available(), false); recorder.dispose();
    let resolve!: (stream: unknown) => void; const waiting = new Promise<unknown>(done => { resolve = done; }); Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => waiting } } });
    trackState = 'live'; const late = createMeasurementRecorder(() => {}, () => {}), preparing = late.prepare(); late.close(); resolve(stream); await preparing; assert.equal(late.available(), false); assert.equal(stopped, 2);
  } finally { if (nav) Object.defineProperty(globalThis, 'navigator', nav); else Reflect.deleteProperty(globalThis, 'navigator'); if (mr) Object.defineProperty(globalThis, 'MediaRecorder', mr); else Reflect.deleteProperty(globalThis, 'MediaRecorder'); }
});
