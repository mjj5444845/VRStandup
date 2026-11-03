import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneAudio } from './scene-audio';
test('scene audio reuses one unlocked context, replaces sources and closes every playback resource', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'), oldFetch = globalThis.fetch; let fetches = 0; globalThis.fetch = async () => { fetches++; return new Response(new Uint8Array(16)); }; let contexts = 0, stops = 0, closes = 0, sources = 0;
  class Node { onended: (() => void) | null = null; buffer: unknown; connect(node: Node) { return node; } disconnect() {} start() {} stop() { stops++; this.onended?.(); } }
  class Context {
    state = 'suspended'; currentTime = 1; destination = new Node(); constructor() { contexts++; }
    resume() { this.state = 'running'; return Promise.resolve(); } close() { closes++; this.state = 'closed'; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration: 12 }); } createBufferSource() { sources++; return new Node(); }
    createOscillator() { return Object.assign(new Node(), { frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} } }); }
    createGain() { return Object.assign(new Node(), { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }); }
  }
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  try {
    const audio = createSceneAudio(); audio.reaction(); await assert.rejects(audio.play(0)); await audio.load(new Uint8Array(10)); await audio.unlock();
    assert.equal(await audio.play(0), 1.04); assert.ok(audio.running()); audio.reaction(); await audio.play(1000); await audio.load(new Uint8Array(20)); await audio.play(2000);
    await audio.prepareClub(); await audio.prepareClub(); assert.equal(fetches, 1); audio.reaction(100, 300); audio.reaction(13000, 500); await audio.play(2000); assert.equal(contexts, 1); assert.equal(sources, 5); assert.ok(stops >= 2); assert.equal(audio.time(), 1); audio.dispose(); assert.equal(closes, 1); assert.equal(audio.running(), false);
  } finally { globalThis.fetch = oldFetch; if (original) Object.defineProperty(globalThis, 'AudioContext', original); else Reflect.deleteProperty(globalThis, 'AudioContext'); }
});
