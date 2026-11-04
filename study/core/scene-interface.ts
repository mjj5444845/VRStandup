import type { ClipManifest } from './materials';
import type { RecordedTake } from './recording';
import type { ConditionId } from './conditions';
import type { Evidence, MediaContext } from './execution';
export type RunClip = { manifest: ClipManifest; take: RecordedTake };
export type ScenePanel = { title: string; lines: string[]; buttons: { id: string; label: string }[]; choose: (id: string) => void; placement?: 'lower' };
export type SceneInfo = { ready: boolean; assetsReady: boolean; playing: boolean; progressMs: number; message: string; fps: number; drawCalls: number; immersive: boolean; xrEntries: number; xrExits: number; headTracked: boolean; inputs: { left: boolean; right: boolean }; captions: { id: string; kind: string; held: boolean; throwable: boolean }[] };
export function initialSceneInfo(): SceneInfo { return { ready: false, assetsReady: false, playing: false, progressMs: 0, message: '正在载入场景。', fps: 0, drawCalls: 0, immersive: false, xrEntries: 0, xrExits: 0, headTracked: false, inputs: { left: false, right: false }, captions: [] }; }
export type SceneCallbacks = { evidence: (e: Evidence) => boolean | void; interrupted: (reason: string) => void; changed: (state: SceneInfo) => void };
export type SceneLoad = { clip: RunClip; context: MediaContext; condition: ConditionId; offsetMs: number; exercise?: 'persistent-captions' };
