import { createPcmCapture } from './pcm-capture';
import { RECORDING_SECONDS } from '../core/recording';
import type { AudioInfo, RecorderAudio } from '../core/audio-interface';
export function createRecorderAudio(): RecorderAudio {
  let context: AudioContext | undefined, stream: MediaStream | undefined, input: MediaStreamAudioSourceNode | undefined, node: AudioWorkletNode | undefined, mute: GainNode | undefined;
  let capture: ReturnType<typeof createPcmCapture> | undefined, generation = 0;
  let processing: AudioInfo['processing'] = { echoCancellation: null, noiseSuppression: null, autoGainControl: null };
  const stopTracks = () => stream?.getTracks().forEach(t => { t.onended = null; t.onmute = null; t.stop(); });
  function info(): AudioInfo { return { timeS: context?.currentTime ?? 0, sampleRate: context?.sampleRate ?? 0, active: stream?.getAudioTracks().some(t => t.readyState === 'live') ?? false, baseLatencySeconds: context?.baseLatency ?? null, processing }; }
  function release() {
    generation++; capture?.cancel(); capture = undefined; stopTracks(); stream = undefined;
    input?.disconnect(); input = undefined;
    if (node) { node.onprocessorerror = null; node.port.onmessage = null; node.port.close(); node.disconnect(); node = undefined; }
    mute?.disconnect(); mute = undefined;
    const old = context; context = undefined; if (old) { old.onstatechange = null; void old.close().catch(() => {}); }
  }
  async function prepare(unavailable: (reason: string) => void) {
    release(); const id = generation;
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('录制需要安全连接与麦克风接口。');
    const audio = new AudioContext({ latencyHint: 'interactive' }); context = audio;
    let pending: MediaStream | undefined;
    try {
      const media = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false }).then(s => {
        if (generation !== id) { s.getTracks().forEach(t => t.stop()); throw new Error('准备已取消。'); } pending = s; return s;
      });
      [pending] = await Promise.all([media, audio.resume()]);
      await audio.audioWorklet.addModule('/study/recorder/pcm-capture.js');
      if (generation !== id) { pending.getTracks().forEach(t => t.stop()); return; }
      stream = pending; const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live' || track.muted || audio.state !== 'running') throw new Error('麦克风或声音时钟不可用。');
      const s = track.getSettings(); processing = { echoCancellation: typeof s.echoCancellation === 'boolean' ? s.echoCancellation : null, noiseSuppression: s.noiseSuppression ?? null, autoGainControl: s.autoGainControl ?? null };
      input = audio.createMediaStreamSource(stream); node = new AudioWorkletNode(audio, 'recording-pcm'); mute = audio.createGain(); mute.gain.value = 0;
      input.connect(node).connect(mute).connect(audio.destination);
      const lost = (reason: string) => { if (generation !== id) return; if (capture) capture.stop(reason, true); else { release(); unavailable(reason); } };
      track.onended = () => lost('microphone-ended'); track.onmute = () => lost('microphone-muted');
      audio.onstatechange = () => { if (audio.state !== 'running') lost('audio-context-interrupted'); };
      node.onprocessorerror = () => { if (generation === id) { if (capture) capture.invalid('worklet-error'); else lost('worklet-error'); } };
      node.port.onmessage = ({ data }: MessageEvent<unknown>) => { if (generation === id) capture?.receive(data); };
    } catch (error) { pending?.getTracks().forEach(t => t.stop()); if (generation === id) release(); throw error; }
  }
  function start(stopping: Parameters<RecorderAudio['start']>[0], complete: Parameters<RecorderAudio['start']>[1]) {
    if (!context || context.state !== 'running' || !node || !info().active || capture) throw new Error('请先准备有效麦克风。');
    const audio = context, startFrame = Math.ceil((audio.currentTime + .15) * audio.sampleRate);
    capture = createPcmCapture({ sampleRate: audio.sampleRate, startFrame,
      sendStop: () => { if (!node) throw new Error('Audio port closed'); node.port.postMessage({ type: 'stop' }); },
      onStopping: (reason, abnormal) => { if (abnormal) stopTracks(); stopping(reason, abnormal); },
      onComplete: result => { const snapshot = info(); try { complete({ ...result, startFrame, info: snapshot }); } finally { release(); } } });
    node.port.postMessage({ type: 'start', startFrame, maxFrames: audio.sampleRate * RECORDING_SECONDS }); return startFrame;
  }
  return { prepare, start, info, release, stop: (reason, abnormal) => capture?.stop(reason, abnormal) };
}
export function createPlaybackAudio() {
  let context: AudioContext | undefined, buffer: AudioBuffer | undefined, source: AudioBufferSourceNode | undefined, generation = 0;
  function pause() { if (source) { source.stop(); source.disconnect(); source = undefined; } }
  async function load(bytes: Uint8Array) {
    dispose(); const id = generation, audio = new AudioContext(); context = audio;
    const decoded = await audio.decodeAudioData(bytes.slice().buffer as ArrayBuffer);
    if (generation === id) buffer = decoded;
  }
  async function play(offsetMs: number) {
    if (!context || !buffer) throw new Error('请先载入声音。'); const id = generation, audio = context;
    await audio.resume(); if (id !== generation) throw new Error('播放已取消。'); pause();
    const next = audio.createBufferSource(); next.buffer = buffer; next.connect(audio.destination); const anchor = audio.currentTime + .05;
    next.start(anchor, offsetMs / 1000); source = next; return anchor;
  }
  function dispose() { generation++; pause(); buffer = undefined; const old = context; context = undefined; if (old) void old.close().catch(() => {}); }
  return { load, play, time: () => context?.currentTime ?? 0, running: () => context?.state === 'running', pause, dispose };
}
