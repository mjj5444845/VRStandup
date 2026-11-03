import type { RecordedTake } from './recording';
export type AudioInfo = { timeS: number; sampleRate: number; active: boolean; baseLatencySeconds: number | null; processing: RecordedTake['audio']['processing'] };
export type CaptureAudioResult = { samples: Float32Array; interrupted: boolean; stopReason: string; finalization: 'acknowledged' | 'buffered-prefix'; audioStopReason: string; startFrame: number; info: AudioInfo };
export type RecorderAudio = {
  prepare: (unavailable: (reason: string) => void) => Promise<void>; info: () => AudioInfo;
  start: (stopping: (reason: string, abnormal: boolean) => void, complete: (result: CaptureAudioResult) => void) => number;
  stop: (reason: string, abnormal: boolean) => void; release: () => void;
};
export type PlaybackAudio = { load: (bytes: Uint8Array) => Promise<void>; play: (offsetMs: number) => Promise<number>; time: () => number; running: () => boolean; pause: () => void; dispose: () => void };
