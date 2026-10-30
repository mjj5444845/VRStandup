import type { AvatarId } from '../../data/avatars';

export type StageDirection = {
  emotion?: 'neutral' | 'warm' | 'excited' | 'dry' | 'serious';
  pace?: number;
  pauseAfterMs?: number;
};

export type PerformanceCue = {
  id: string;
  order: number;
  avatarId: AvatarId;
  text: string;
  direction?: StageDirection;
};

export type PerformanceScript = {
  id: string;
  title: string;
  language: string;
  cues: PerformanceCue[];
};

export type CastBinding = {
  avatarId: AvatarId;
  roleName: string;
};

export type PerformancePlan = {
  script: PerformanceScript;
  cast: CastBinding[];
};
