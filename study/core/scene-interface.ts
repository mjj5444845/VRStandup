import type { ClipManifest } from './materials';
import type { RecordedTake } from './recording';
import type { ConditionId } from './conditions';
import type { Evidence, MediaContext } from './execution';
export type RunClip = { manifest: ClipManifest; take: RecordedTake };
export type ScenePanel = { title: string; lines: string[]; buttons: { id: string; label: string }[]; choose: (id: string) => void };
export type SceneInfo = { ready: boolean; playing: boolean; progressMs: number; message: string; fps: number; drawCalls: number; captions: { id: string; kind: string; held: boolean; throwable: boolean }[] };
export type SceneCallbacks = { evidence: (e: Evidence) => boolean | void; interrupted: (reason: string) => void; changed: (state: SceneInfo) => void };
export type SceneLoad = { clip: RunClip; context: MediaContext; condition: ConditionId; offsetMs: number };
