import { audioPositionMs, chooseVideoCorrection, evaluateMediaCheck, MEDIA_LIMITS, VIDEO_CORRECTION_START_MS, type FollowRate, type MediaVerdict } from './media-check-rules';

type Phase = 'idle' | 'preparing' | 'ready' | 'starting' | 'playing' | 'finished' | 'error';
export type MediaSample = { audioMs: number; videoMs: number; driftMs: number; rate: FollowRate; seeking: boolean };
export type MediaReport = {
  version: 1;
  createdAt: string;
  browser: string;
  method: 'video-frame-callback' | 'video-current-time';
  limits: typeof MEDIA_LIMITS;
  correctionStartMs: number;
  elapsedMs: number;
  maxAbsMs: number;
  maxSampleGapMs: number;
  firstVideoMs: number;
  seekCount: number;
  interrupted: boolean;
  verdict: MediaVerdict;
  samples: MediaSample[];
};
export type MediaSnapshot = {
  phase: Phase; message: string; elapsedMs: number; driftMs: number; maxAbsMs: number;
  sampleCount: number; rate: FollowRate; method: string; report: MediaReport | null;
};
export const INITIAL_MEDIA: MediaSnapshot = {
  phase: 'idle', message: '先准备新生成的测试画面和声音。', elapsedMs: 0, driftMs: 0,
  maxAbsMs: 0, sampleCount: 0, rate: 1, method: '待检查', report: null,
};
const FIXTURE = '/study/checks/media-clock/';
// Engineering guard, not a relaxed S3 study threshold: do not declare success
// if browser scheduling leaves a large hole in the observed frame stream.
const MAX_SAMPLE_GAP_MS = 250;

/** Standalone S3 check. AudioContext.currentTime is the only playback clock. */
export function createMediaCheck(video: HTMLVideoElement, onChange: (snapshot: MediaSnapshot) => void) {
  let snapshot = { ...INITIAL_MEDIA };
  let context: AudioContext | undefined;
  let audioBuffer: AudioBuffer | undefined;
  let source: AudioBufferSourceNode | undefined;
  let gain: GainNode | undefined;
  let priming: ConstantSourceNode | undefined;
  let abort: AbortController | undefined;
  let disposed = false;
  let epoch = 0;
  let raf = 0;
  let frameCallback = 0;
  let startedAtS = 0;
  let samples: MediaSample[] = [];
  let maxAbsMs = 0;
  let lastSampleAt = 0;
  let maxSampleGapMs = 0;
  let firstVideoMs = 0;
  let seekCount = 0;
  let rate: FollowRate = 1;
  let lastUiAt = 0;
  let method: MediaReport['method'] = 'video-current-time';

  function publish(patch: Partial<MediaSnapshot>) {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    onChange(snapshot);
  }
  function stopPlayback() {
    cancelAnimationFrame(raf);
    if (frameCallback && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(frameCallback);
    frameCallback = 0;
    const previous = source;
    source = undefined;
    if (previous) {
      previous.onended = null;
      try { previous.stop(); } catch { /* An unstarted source may be cancelled. */ }
      previous.disconnect();
    }
    gain?.disconnect();
    gain = undefined;
    if (priming) { priming.stop(); priming.disconnect(); priming = undefined; }
    video.pause();
    video.playbackRate = 1;
    if (context?.state === 'running') void context.suspend().catch(() => {});
  }
  function finish(interrupted: boolean, message: string) {
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'starting') return;
    const elapsedMs = snapshot.phase === 'playing' && context ? audioPositionMs(context.currentTime, startedAtS) : 0;
    // Mark the run ended before pausing media, so induced media events cannot
    // recursively turn a completed run into a second, contradictory report.
    snapshot = { ...snapshot, phase: 'finished' };
    epoch++;
    stopPlayback();
    const verdict = evaluateMediaCheck({ elapsedMs, maxAbsMs, samples: samples.length, interrupted });
    const report: MediaReport = {
      version: 1, createdAt: new Date().toISOString(), browser: navigator.userAgent, method,
      limits: MEDIA_LIMITS, correctionStartMs: VIDEO_CORRECTION_START_MS, elapsedMs, maxAbsMs, maxSampleGapMs, firstVideoMs, seekCount,
      interrupted, verdict, samples: [...samples],
    };
    publish({ phase: 'finished', elapsedMs, rate: 1, report, maxAbsMs, sampleCount: samples.length,
      driftMs: samples.at(-1)?.driftMs ?? 0, message: interrupted ? message
      : verdict === 'pass' ? '本次本机检查通过：连续 60 秒，最大偏差小于 40 毫秒。'
      : verdict === 'fail' ? '本次未通过：至少一次偏差达到或超过 40 毫秒。请保留记录。'
      : '本次检查未完整完成，不能记为通过。' });
  }
  function interrupt(message: string) { finish(true, message); }

  function sample(videoTimeS: number) {
    if (snapshot.phase !== 'playing' || !context) return;
    const audioMs = audioPositionMs(context.currentTime, startedAtS);
    const now = performance.now();
    const gap = now - lastSampleAt;
    maxSampleGapMs = Math.max(maxSampleGapMs, gap);
    lastSampleAt = now;
    const driftMs = videoTimeS * 1000 - audioMs;
    // Record the raw error before applying any correction, including startup
    // and seek outliers. The report never subtracts a fitted baseline.
    maxAbsMs = Math.max(maxAbsMs, Math.abs(driftMs));
    samples.push({ audioMs, videoMs: videoTimeS * 1000, driftMs, rate, seeking: video.seeking });
    if (gap > MAX_SAMPLE_GAP_MS) { interrupt('画面采样出现超过 250 毫秒的空档，本次不作通过判断。请保持检查页在前台再试。'); return; }
    if (!video.seeking) {
      const correction = chooseVideoCorrection(driftMs, rate);
      rate = correction.rate;
      video.playbackRate = rate;
      if (correction.seek) { seekCount++; video.currentTime = audioMs / 1000; }
    }
    if (now - lastUiAt > 100) {
      lastUiAt = now;
      publish({ elapsedMs: audioMs, driftMs, maxAbsMs, rate, sampleCount: samples.length });
    }
  }
  function videoFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
    if (snapshot.phase !== 'playing') return;
    sample(metadata.mediaTime);
    if (snapshot.phase === 'playing') frameCallback = video.requestVideoFrameCallback(videoFrame);
  }
  function tick() {
    if (snapshot.phase !== 'playing' || !context) return;
    if (method === 'video-current-time') sample(video.currentTime);
    if (snapshot.phase !== 'playing') return;
    if (performance.now() - lastSampleAt > MAX_SAMPLE_GAP_MS) {
      interrupt('视频帧采样停顿超过 250 毫秒，本次不作通过判断。');
      return;
    }
    if (audioPositionMs(context.currentTime, startedAtS) >= MEDIA_LIMITS.durationMs) {
      finish(false, '');
      return;
    }
    if (snapshot.phase === 'playing') raf = requestAnimationFrame(tick);
  }

  function loadVideo(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => done(new Error('测试画面加载超时。')), 15000);
      function done(error?: Error) {
        clearTimeout(timeout);
        video.removeEventListener('canplaythrough', loaded);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
        if (error) reject(error); else resolve();
      }
      function loaded() { done(); }
      function failed() { done(new Error('测试画面加载或解码失败，请确认素材和浏览器。')); }
      function cancelled() { done(new Error('已取消准备。')); }
      video.addEventListener('canplaythrough', loaded, { once: true });
      video.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', cancelled, { once: true });
      video.src = `${FIXTURE}clock.mp4`;
      video.load();
    });
  }

  async function prepare() {
    if (disposed || ['preparing', 'starting', 'playing'].includes(snapshot.phase)) return;
    const currentEpoch = ++epoch;
    stopPlayback();
    abort?.abort();
    abort = new AbortController();
    const currentAbort = abort;
    const previousContext = context;
    context = undefined;
    if (previousContext && previousContext.state !== 'closed') void previousContext.close().catch(() => {});
    audioBuffer = undefined;
    const currentContext = new AudioContext({ latencyHint: 'interactive' });
    context = currentContext;
    // Open the audio output during preparation with a zero-valued source. A
    // cold device can report running before currentTime actually advances.
    // Keep it open until the run ends; do not mask that delay in recorded data.
    priming = currentContext.createConstantSource();
    priming.offset.value = 0;
    priming.connect(currentContext.destination);
    priming.start();
    const resumed = currentContext.resume();
    video.muted = true;
    video.playsInline = true;
    method = typeof video.requestVideoFrameCallback === 'function' ? 'video-frame-callback' : 'video-current-time';
    publish({ ...INITIAL_MEDIA, phase: 'preparing', method, message: '正在准备画面和声音…' });
    try {
      const [, buffer] = await Promise.all([
        loadVideo(currentAbort.signal),
        fetch(`${FIXTURE}click.wav`, { signal: currentAbort.signal }).then(async (response) => {
          if (!response.ok) throw new Error('测试声音下载失败。');
          return currentContext.decodeAudioData(await response.arrayBuffer());
        }),
        resumed,
      ]);
      if (disposed || epoch !== currentEpoch) return;
      if (buffer.duration < 61 || video.duration < 61) throw new Error('测试素材长度不足，不能做完整 60 秒检查。');
      audioBuffer = buffer;
      video.currentTime = 0;
      // Preparing may complete before the hardware's first render quantum.
      // Observe real clock advancement rather than imposing a timed offset.
      await new Promise<void>((resolve, reject) => {
        let pendingFrame = 0;
        const initialTime = currentContext.currentTime;
        const timeout = setTimeout(() => settle(new Error('声音时钟未开始运行，请检查系统音频设备。')), 5000);
        function settle(error?: Error) {
          clearTimeout(timeout);
          cancelAnimationFrame(pendingFrame);
          currentAbort.signal.removeEventListener('abort', cancelled);
          if (error) reject(error); else resolve();
        }
        function cancelled() { settle(new Error('准备已取消。')); }
        function observe() {
          if (currentContext.currentTime > initialTime) settle();
          else pendingFrame = requestAnimationFrame(observe);
        }
        currentAbort.signal.addEventListener('abort', cancelled, { once: true });
        pendingFrame = requestAnimationFrame(observe);
      });
      if (disposed || epoch !== currentEpoch) return;
      publish({ phase: 'ready', message: '素材已准备好。开始后请保持本页在前台 60 秒，会听到轻声节拍。' });
    } catch (error) {
      if (disposed || epoch !== currentEpoch) return;
      currentAbort.abort();
      stopPlayback();
      publish({ phase: 'error', message: error instanceof Error ? error.message : '素材准备失败，请重试。' });
    }
  }

  function start() {
    if (disposed || snapshot.phase !== 'ready' || !context || !audioBuffer) return;
    const currentContext = context;
    const currentEpoch = ++epoch;
    samples = []; maxAbsMs = 0; maxSampleGapMs = 0; firstVideoMs = 0; seekCount = 0; rate = 1;
    publish({ phase: 'starting', message: '正在开始声音与画面…' });
    // Initiate both browser permissions in the button's synchronous gesture.
    // Wait only for readiness, not a wall-clock delay, before starting the source.
    const resumed = currentContext.resume();
    const played = video.play();
    void Promise.all([resumed, played]).then(() => {
      if (disposed || epoch !== currentEpoch) return;
      if (document.hidden) { interrupt('检查页不在前台，本次已停止。'); return; }
      const currentSource = currentContext.createBufferSource();
      currentSource.buffer = audioBuffer!;
      source = currentSource;
      gain = currentContext.createGain();
      gain.gain.value = 0.15;
      currentSource.connect(gain).connect(currentContext.destination);
      firstVideoMs = video.currentTime * 1000;
      startedAtS = currentContext.currentTime;
      currentSource.start(startedAtS);
      lastSampleAt = performance.now();
      lastUiAt = 0;
      currentSource.onended = () => interrupt('声音提前结束，本次未完成。');
      publish({ phase: 'playing', message: '正在检查，请保持本页在前台。', elapsedMs: 0, maxAbsMs: 0, sampleCount: 0 });
      if (method === 'video-frame-callback') frameCallback = video.requestVideoFrameCallback(videoFrame);
      raf = requestAnimationFrame(tick);
    }).catch(() => {
      if (!disposed && epoch === currentEpoch) interrupt('浏览器未能启动声音或视频，请重新准备并亲自点击开始。');
    });
  }
  function visibility() { if (document.hidden) interrupt('页面切到后台，本次已停止；请重新准备后保持前台 60 秒。'); }
  function waiting() { interrupt('视频发生缓冲等待，本次连续播放已中断。'); }
  function videoError() { interrupt('视频播放失败，本次已停止。'); }
  function audioState() { if (context?.state !== 'running' && snapshot.phase === 'playing') interrupt('声音时钟已中断，本次已停止。'); }
  function ended() { interrupt('视频提前结束，本次未完成。'); }
  document.addEventListener('visibilitychange', visibility);
  video.addEventListener('waiting', waiting);
  video.addEventListener('error', videoError);
  video.addEventListener('ended', ended);
  // Contexts are created on prepare; the property handler is assigned there by
  // a small wrapper so retries do not leave listeners on discarded contexts.
  const prepareWithState = async () => {
    const preparing = prepare();
    if (context) context.onstatechange = audioState;
    await preparing;
  };
  function stop() { interrupt('已主动停止，本次没有完成连续 60 秒。'); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    epoch++;
    abort?.abort();
    stopPlayback();
    document.removeEventListener('visibilitychange', visibility);
    video.removeEventListener('waiting', waiting);
    video.removeEventListener('error', videoError);
    video.removeEventListener('ended', ended);
    if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
    video.removeAttribute('src');
    video.load();
  }
  return { prepare: prepareWithState, start, stop, dispose };
}
