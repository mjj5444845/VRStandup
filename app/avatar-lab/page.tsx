import type { Metadata } from 'next';
import { AvatarLabClient } from './avatar-lab-client';

export const metadata: Metadata = {
  title: 'Mixamo Avatar 动作实验室 — VR Standup',
  description: '在 A-Frame/WebVR 中加载 Mixamo GLB，并按 clip 名称实时切换动画。',
};

export default function AvatarLabPage() {
  return <AvatarLabClient />;
}
