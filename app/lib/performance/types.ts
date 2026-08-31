import type { AvatarId } from '../../data/avatars';

export type DeliveryDirection = {
  emotion?: 'neutral' | 'warm' | 'excited' | 'dry' | 'serious';
  pace?: number;
  pitch?: number;
  pauseAfterMs?: number;
};

export type PerformanceCue = {
  id: string;
  order: number;
  avatarId: AvatarId;
  text: string;
  direction?: DeliveryDirection;
};

export type PerformanceScript = {
  id: string;
  title: string;
  language: string;
  cues: PerformanceCue[];
};

export type VoiceBinding = {
  avatarId: AvatarId;
  provider: string;
  providerVoiceId: string;
  stylePrompt?: string;
};

export type TtsRequest = {
  cue: PerformanceCue;
  voice: VoiceBinding;
  format: 'mp3' | 'wav';
};

export type TtsResult = {
  cueId: string;
  audioUrl: string;
  durationMs: number;
};

export interface TtsProvider {
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export type PerformanceManifest = {
  script: PerformanceScript;
  voices: VoiceBinding[];
  audio: TtsResult[];
};
