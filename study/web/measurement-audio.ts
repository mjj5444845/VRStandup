import { MEASUREMENT_AUDIO_BYTES, type AudioMarker, type AudioUpload } from '../core/measurement';
import { runHeaders, type RunIdentity } from './runtime-api';
export type AudioSegment = { metadata: AudioUpload; blob: Blob };
export function createMeasurementRecorder(changed: (message: string) => void, finished: (segment: AudioSegment) => void) {
  let stream: MediaStream | null = null, recorder: MediaRecorder | null = null, chunks: Blob[] = [], bytes = 0, metadata: AudioUpload | null = null, start = 0, reason = '', generation = 0;
  const pending: AudioSegment[] = []; let stopping = false;
  function stop(cause: string) { if (recorder && recorder.state !== 'inactive' && !stopping) { reason = cause; stopping = true; recorder.stop(); } }
  function close() { generation++; stop('microphone-closed'); stream?.getTracks().forEach(t => { t.onended = null; t.onmute = null; t.stop(); }); stream = null; changed('麦克风已关闭；已结束分段可下载或重试保存。'); }
  async function prepare() {
    if (recorder || stopping) throw new Error('先结束并保存本轮录音。'); close(); const id = generation;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('此浏览器不支持实验录音。');
    const result = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (generation !== id) { result.getTracks().forEach(t => t.stop()); return; } stream = result;
    result.getAudioTracks().forEach(t => { t.onended = () => { stop('microphone-ended'); changed('麦克风断开，请复查本轮。'); }; t.onmute = () => { stop('microphone-muted'); changed('麦克风静音，请复查本轮。'); }; }); changed('实验麦克风已准备；只在播放阶段分段录制。');
  }
  function begin(input: Omit<AudioUpload, 'schema' | 'id' | 'mime' | 'source' | 'startedAt' | 'stoppedAt' | 'reason' | 'markers'>, marker: AudioMarker) {
    if (!stream?.getAudioTracks().some(t => t.readyState === 'live' && !t.muted)) return false;
    if (recorder && recorder.state !== 'inactive') return true;
    if (stopping) return false;
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) throw new Error('没有可用的录音容器。');
    chunks = []; bytes = 0; start = performance.now(); reason = ''; stopping = false;
    metadata = { ...input, schema: 'punchcap-measurement-audio-v1', id: crypto.randomUUID(), mime, source: 'microphone', startedAt: new Date().toISOString(), stoppedAt: new Date().toISOString(), reason: 'recording', markers: [{ ...marker, elapsedMs: 0 }] };
    const current = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 96000 }); recorder = current;
    current.ondataavailable = event => { if (event.data.size) { bytes += event.data.size; chunks.push(event.data); if (bytes > MEASUREMENT_AUDIO_BYTES) stop('segment-size-limit'); } };
    current.onerror = () => { stop('recorder-error'); changed('录音发生错误，已保留收到的分段。'); };
    current.onstop = () => {
      const value = metadata, blob = new Blob(chunks, { type: mime }); metadata = null; recorder = null; chunks = []; stopping = false;
      if (!value || !blob.size) { changed('本段没有有效录音数据。'); return; }
      const segment = { metadata: { ...value, stoppedAt: new Date().toISOString(), reason: reason || 'stopped' }, blob }; pending.push(segment); try { finished(segment); changed('录音分段已保留，请确认本机保存结果。'); } catch { changed('保存处理失败，原始分段仍保留供下载或重试。'); }
    }; current.start(1000); changed('实验麦克风正在录音。'); return true;
  }
  function mark(marker: AudioMarker) { if (metadata && metadata.markers.length < 1000) metadata.markers.push({ ...marker, elapsedMs: performance.now() - start }); }
  function dispose() { close(); }
  return { prepare, begin, mark, stop, close, dispose, available: () => Boolean(stream?.getAudioTracks().some(t => t.readyState === 'live' && !t.muted && t.enabled !== false)), recording: () => Boolean(recorder && recorder.state !== 'inactive'), pending: () => [...pending], confirmed: (id: string) => { const index = pending.findIndex(s => s.metadata.id === id); if (index >= 0) pending.splice(index, 1); } };
}
export async function uploadMeasurement(identity: RunIdentity, segment: AudioSegment) {
  if (segment.blob.size > MEASUREMENT_AUDIO_BYTES) throw new Error('录音超过工程分段上限，请下载原件复查。');
  const response = await fetch('/api/run/audio', { method: 'POST', headers: { ...runHeaders(identity), 'x-punchcap-metadata': encodeURIComponent(JSON.stringify(segment.metadata)), 'Content-Type': segment.metadata.mime }, body: segment.blob }); if (!response.ok) throw new Error('录音保存未确认，本机副本保留，请重试或下载。'); return response.json() as Promise<unknown>;
}
