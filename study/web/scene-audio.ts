import type { PlaybackAudio } from '../core/audio-interface';
import { CLUB_BASE } from '../core/club-assets';
/** One context survives clip/response changes so the initial user gesture unlocks the whole run. */
export function createSceneAudio(): PlaybackAudio & { unlock: () => Promise<void>; prepareClub: () => Promise<void>; reaction: (offsetMs?: number, durationMs?: number) => void } {
  let context: AudioContext | undefined, buffer: AudioBuffer | undefined, source: AudioBufferSourceNode | undefined, serial = 0;
  const effects = new Map<AudioBufferSourceNode, GainNode>(); let reactionBuffer: AudioBuffer | undefined, reactionPreparation: Promise<void> | undefined;
  const get = () => context ??= new AudioContext({ latencyHint: 'interactive' });
  function pause() { if (source) { source.onended = null; source.stop(); source.disconnect(); source = undefined; } for (const [e, gain] of effects) { e.onended = null; e.stop(); e.disconnect(); gain.disconnect(); } effects.clear(); }
  async function unlock() { const c = get(); await c.resume(); if (c.state !== 'running') throw new Error('请点击启用声音后再开始。'); }
  async function load(bytes: Uint8Array) { pause(); buffer = undefined; const id = ++serial, decoded = await get().decodeAudioData(bytes.slice().buffer as ArrayBuffer); if (serial === id) buffer = decoded; }
  async function play(offsetMs: number) { await unlock(); if (!buffer) throw new Error('声音尚未载入。'); pause(); const c = get(), s = c.createBufferSource(); s.buffer = buffer; s.connect(c.destination); const anchor = c.currentTime + .04; s.start(anchor, offsetMs / 1000); source = s; return anchor; }
  async function prepareClub() {
    if (reactionPreparation) return reactionPreparation; const c = get();
    reactionPreparation = (async () => { const r = await fetch(`${CLUB_BASE}/audio/working/laugh-short.wav`, { cache: 'force-cache' }); if (!r.ok) throw new Error('人群声音载入失败。'); const decoded = await c.decodeAudioData(await r.arrayBuffer()); if (context === c) reactionBuffer = decoded; })();
    try { await reactionPreparation; } catch (e) { reactionPreparation = undefined; throw e; }
  }
  function reaction(offsetMs = 0, durationMs = Infinity) { if (!context || context.state !== 'running' || !reactionBuffer || offsetMs / 1000 >= reactionBuffer.duration || durationMs <= 0) return; const c = context, s = c.createBufferSource(), g = c.createGain(); s.buffer = reactionBuffer; g.gain.setValueAtTime(.35, c.currentTime); s.connect(g).connect(c.destination); effects.set(s, g); s.onended = () => { effects.delete(s); s.disconnect(); g.disconnect(); }; s.start(c.currentTime, offsetMs / 1000, Math.min(durationMs / 1000, reactionBuffer.duration - offsetMs / 1000)); }
  function dispose() { serial++; pause(); buffer = undefined; reactionBuffer = undefined; const c = context; context = undefined; if (c) void c.close().catch(() => {}); }
  return { unlock, load, play, pause, prepareClub, reaction, time: () => context?.currentTime ?? 0, running: () => context?.state === 'running', dispose };
}
