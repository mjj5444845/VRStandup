import { RECORDING_SECONDS } from '../core/recording';

export type CaptureResult = {
  samples: Float32Array; interrupted: boolean; stopReason: string;
  finalization: 'acknowledged' | 'buffered-prefix'; audioStopReason: string;
};
export type CaptureClock = { later: (run: () => void, ms: number) => unknown; cancel: (id: unknown) => void };
const browserClock: CaptureClock = {
  later: (run, ms) => setTimeout(run, ms), cancel: id => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Retain only contiguous PCM already received, even if the audio thread stops replying. */
export function createPcmCapture(options: {
  sampleRate: number; startFrame: number; sendStop: () => void;
  onStopping: (reason: string, abnormal: boolean) => void;
  onComplete: (result: CaptureResult) => void; clock?: CaptureClock;
}) {
  const { sampleRate, startFrame } = options, clock = options.clock ?? browserClock;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || !Number.isSafeInteger(startFrame) || startFrame < 0) throw new Error('录音时钟无效。');
  let phase: 'recording' | 'stopping' | 'ended' = 'recording', chunks: Float32Array[] = [], count = 0;
  let stopReason = '', interrupted = false, timer: unknown;
  function clear() { if (timer !== undefined) clock.cancel(timer); timer = undefined; }
  function complete(finalization: CaptureResult['finalization'], audioStopReason: string) {
    if (phase === 'ended') return;
    clear(); phase = 'ended';
    const samples = new Float32Array(count); let offset = 0;
    for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; } chunks = [];
    options.onComplete({ samples, interrupted, stopReason: stopReason || audioStopReason, finalization, audioStopReason });
  }
  function stop(reason: string, abnormal: boolean) {
    if (phase === 'ended') return;
    if (phase === 'stopping') {
      // A later interruption must never turn an in-flight manual stop into a clean take.
      if (abnormal && !interrupted) { interrupted = true; stopReason = reason; options.onStopping(reason, true); }
      return;
    }
    phase = 'stopping'; stopReason = reason; interrupted = abnormal; clear();
    options.onStopping(reason, abnormal);
    // Failure deadline only. Neither sample timestamps nor playback use this timer.
    timer = clock.later(() => { interrupted = true; complete('buffered-prefix', 'audio-finalize-timeout'); }, 2000);
    try { options.sendStop(); } catch { interrupted = true; complete('buffered-prefix', 'audio-port-unavailable'); }
  }
  function invalid(reason: string) {
    if (phase === 'ended') return;
    interrupted = true; stopReason = reason;
    // Disconnecting the worklet is owned by onComplete in the browser controller.
    complete('buffered-prefix', reason);
  }
  function chunk(frame: number, samples: Float32Array) {
    if (phase === 'ended') return;
    if (!Number.isSafeInteger(frame) || frame !== startFrame + count || !samples.length
      || count + samples.length > sampleRate * RECORDING_SECONDS || !samples.every(Number.isFinite)) { invalid('pcm-chunk-invalid'); return; }
    chunks.push(samples.slice()); count += samples.length;
  }
  function finish(data: { frames: number; sampleRate: number; startFrame: number; reason: string }) {
    if (phase === 'ended') return;
    if (data.frames !== count || data.sampleRate !== sampleRate || data.startFrame !== startFrame
      || !['user', 'limit', 'input-missing', 'clock-gap'].includes(data.reason)
      || (data.reason === 'limit' && count !== sampleRate * RECORDING_SECONDS)
      || (data.reason === 'user' && phase !== 'stopping')) { invalid('pcm-finalization-invalid'); return; }
    if (data.reason !== 'user' && data.reason !== 'limit') { interrupted = true; stopReason ||= data.reason; }
    complete('acknowledged', data.reason);
  }
  function cancel() { clear(); phase = 'ended'; chunks = []; count = 0; }
  function receive(data: unknown) {
    if (phase === 'ended') return;
    if (typeof data !== 'object' || data === null) { invalid('pcm-message-invalid'); return; }
    const message = data as Record<string, unknown>;
    if (message.type === 'chunk' && message.samples instanceof Float32Array && typeof message.startFrame === 'number') chunk(message.startFrame, message.samples);
    else if (message.type === 'stopped' && typeof message.frames === 'number' && typeof message.sampleRate === 'number' && typeof message.startFrame === 'number' && typeof message.reason === 'string') {
      finish({ frames: message.frames, sampleRate: message.sampleRate, startFrame: message.startFrame, reason: message.reason });
    } else invalid(message.type === 'error' ? 'worklet-error' : 'pcm-message-invalid');
  }
  timer = clock.later(() => stop('capture-watchdog', true), (RECORDING_SECONDS + 2) * 1000);
  return { chunk, finish, stop, invalid, receive, cancel };
}

export function recordingStopLabel(reason: string): string {
  const labels: Record<string, string> = {
    user: '手动结束', limit: '达到录制上限自动结束', 'xr-session-ended': '录制中退出 VR',
    'xr-visible-blurred': '系统界面遮挡了 VR', 'xr-hidden': 'VR 进入后台', 'page-hidden': '网页进入后台',
    'reference-space-reset': '定位空间发生重设', 'microphone-ended': '麦克风已断开', 'microphone-muted': '麦克风输入被暂停',
    'audio-context-interrupted': '声音时钟被暂停', 'audio-finalize-timeout': '声音线程未完成收尾',
    'audio-port-unavailable': '声音线程无法连接', 'capture-watchdog': '录制超时保护',
    'pcm-chunk-invalid': '声音采样块不连续或无效', 'pcm-finalization-invalid': '声音结束信息不一致',
    'pcm-message-invalid': '声音线程消息无效',
    'input-missing': '声音线程没有输入', 'clock-gap': '声音采样时钟有空档',
    'xr-frame-gap': '动作采样有长时间空档', 'webgl-context-lost': '三维画面已断开', 'render-failure': '三维画面发生错误',
    'worklet-error': '声音线程发生错误',
  };
  return Object.hasOwn(labels, reason) ? labels[reason] : '其他原因（已记录）';
}
