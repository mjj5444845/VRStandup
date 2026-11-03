import type { Mapping } from './materials';
export const CLUB_BASE = '/study/club/v1';
export const CLUB_MAPPING: Mapping = {
  id: 'soft-clay-actor-head-hands-v1', modelId: 'actor', modelVersion: 'v1-candidate', heightMetres: 1.605,
  nodes: { head: 'Head', leftHand: 'LeftHand', rightHand: 'RightHand' },
  offsets: { head: [0, 0, 0], leftHand: [0, 0, 0], rightHand: [0, 0, 0] },
  approval: { status: 'draft', reviewer: '', reviewedAt: '', basis: '' },
};
export const CLUB_CAPTIONS = [
  { id: 'expressive-wow', kind: 'expressive', text: '哇！' }, { id: 'expressive-eh', kind: 'expressive', text: '啊？' },
  { id: 'expressive-got-it', kind: 'expressive', text: '懂了！' }, { id: 'expressive-steady', kind: 'expressive', text: '稳住' },
  { id: 'distancing-plan', kind: 'distancing', text: '这就叫规划' }, { id: 'distancing-mood', kind: 'distancing', text: '情绪稳定中' },
  { id: 'distancing-logic', kind: 'distancing', text: '逻辑正在加载' }, { id: 'distancing-twist', kind: 'distancing', text: '反转来了' },
] as const;
