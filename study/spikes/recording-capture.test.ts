import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPcmCapture, type CaptureClock, type CaptureResult } from './recording-capture';

function setup() {
  let now = 0, next = 0, stops = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: CaptureClock = { later: (run, ms) => { const id = ++next; timers.set(id, { at: now + ms, run }); return id; }, cancel: id => { timers.delete(id as number); } };
  const results: CaptureResult[] = [], signals: string[] = [];
  const make = () => createPcmCapture({ sampleRate: 8000, startFrame: 80, clock,
    sendStop: () => { stops++; }, onStopping: reason => signals.push(reason), onComplete: result => results.push(result) });
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break; const [id, t] = due; now = t.at; timers.delete(id); t.run();
    }
    now = end;
  }
  return { make, results, signals, advance, stops: () => stops, timers };
}

test('normal stop waits for the real tail block and cancels all previous deadlines', () => {
  const s = setup(), first = s.make(); first.chunk(80, new Float32Array(800));
  s.advance(1000); first.stop('user', false); first.chunk(880, new Float32Array(80));
  first.finish({ frames: 880, sampleRate: 8000, startFrame: 80, reason: 'user' });
  assert.equal(s.results[0].samples.length, 880); assert.equal(s.results[0].interrupted, false); assert.equal(s.timers.size, 0);
  s.advance(15000); const second = s.make(); second.chunk(80, new Float32Array(800));
  s.advance(1500); assert.equal(s.stops(), 1); assert.equal(s.results.length, 1);
  second.cancel(); assert.equal(s.timers.size, 0);
});

test('suspended audio preserves only acknowledged contiguous PCM and ignores late replies', () => {
  const s = setup(), capture = s.make(); capture.chunk(80, new Float32Array(2048).fill(.25));
  capture.stop('audio-context-interrupted', true); s.advance(2000);
  assert.equal(s.results.length, 1); const result = s.results[0];
  assert.equal(result.samples.length, 2048); assert.equal(result.samples[2047], .25);
  assert.equal(result.interrupted, true); assert.equal(result.stopReason, 'audio-context-interrupted');
  assert.equal(result.finalization, 'buffered-prefix'); assert.equal(result.audioStopReason, 'audio-finalize-timeout');
  capture.chunk(2128, new Float32Array(128)); capture.finish({ frames: 2176, sampleRate: 8000, startFrame: 80, reason: 'user' });
  s.advance(20000); assert.equal(s.results.length, 1); assert.equal(s.timers.size, 0);
});

test('XR interruption during a pending manual stop is retained without resetting its deadline', () => {
  const s = setup(), capture = s.make(); capture.chunk(80, new Float32Array(800));
  capture.stop('user', false); s.advance(1500); capture.stop('xr-session-ended', true); s.advance(500);
  assert.equal(s.results[0].interrupted, true); assert.equal(s.results[0].stopReason, 'xr-session-ended');
  assert.equal(s.stops(), 1); assert.deepEqual(s.signals, ['user', 'xr-session-ended']);
});

test('invalid chunks and dishonest finish counts never produce a clean take or invent padding', () => {
  for (const failure of ['gap', 'nan', 'finish'] as const) {
    const s = setup(), capture = s.make(); capture.chunk(80, new Float32Array(800).fill(.5));
    if (failure === 'gap') capture.chunk(1000, new Float32Array(128));
    else if (failure === 'nan') capture.chunk(880, new Float32Array([NaN]));
    else capture.finish({ frames: 900, sampleRate: 8000, startFrame: 80, reason: 'limit' });
    assert.equal(s.results[0].samples.length, 800); assert.equal(s.results[0].interrupted, true);
    assert.equal(s.results[0].finalization, 'buffered-prefix'); assert.equal(s.timers.size, 0);
  }
});

test('automatic stop requires the exact limit; a lost stop acknowledgement is flagged', () => {
  const s = setup(), capture = s.make(); capture.chunk(80, new Float32Array(120000));
  capture.finish({ frames: 120000, sampleRate: 8000, startFrame: 80, reason: 'limit' });
  assert.equal(s.results[0].interrupted, false); assert.equal(s.results[0].stopReason, 'limit');
  const failed = s.make(); failed.chunk(80, new Float32Array(800)); s.advance(19000);
  assert.equal(s.results[1].interrupted, true); assert.equal(s.results[1].stopReason, 'capture-watchdog');
});

test('cancelling a capture cancels timers and prevents stale callbacks entering a new capture', () => {
  const s = setup(), first = s.make(); first.chunk(80, new Float32Array(800)); first.cancel();
  const next = s.make(); first.finish({ frames: 800, sampleRate: 8000, startFrame: 80, reason: 'limit' });
  s.advance(3000); assert.equal(s.results.length, 0); assert.equal(s.stops(), 0);
  next.cancel(); s.advance(30000); assert.equal(s.results.length, 0);
});

test('actual worklet messages complete the receiver with exact PCM, or retain its prefix on input loss', async () => {
  for (const mode of ['limit', 'missing'] as const) {
    type Processor = { port: { onmessage: (event: { data: unknown }) => void }; process: (inputs: Float32Array[][]) => boolean };
    let Constructor: (new () => Processor) | undefined;
    const results: CaptureResult[] = [];
    const capture = createPcmCapture({ sampleRate: 8000, startFrame: 80, sendStop: () => {}, onStopping: () => {}, onComplete: result => results.push(result) });
    const scope = { currentFrame: 0, sampleRate: 8000, Float32Array,
      AudioWorkletProcessor: class { port = { onmessage: () => {}, postMessage: (message: unknown) => capture.receive(message) }; },
      registerProcessor: (_name: string, processor: new () => Processor) => { Constructor = processor; } };
    vm.runInNewContext(await readFile(new URL('../../public/study/checks/recording/pcm-capture.js', import.meta.url), 'utf8'), scope);
    assert.ok(Constructor); const processor = new Constructor();
    processor.port.onmessage({ data: { type: 'start', startFrame: 80, maxFrames: 120000 } });
    for (let i = 0; i < (mode === 'limit' ? 939 : 20); i++) { scope.currentFrame = i * 128; processor.process([[new Float32Array(128).fill(.25)]]); }
    if (mode === 'missing') { scope.currentFrame = 2560; processor.process([[]]); }
    assert.equal(results.length, 1); assert.equal(results[0].samples.length, mode === 'limit' ? 120000 : 2480);
    assert.equal(results[0].interrupted, mode === 'missing'); assert.equal(results[0].stopReason, mode === 'limit' ? 'limit' : 'input-missing');
    assert.ok(results[0].samples.every(s => s === .25));
  }
});
