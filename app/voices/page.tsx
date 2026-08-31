import type { Metadata } from 'next';
import { VoiceLab } from './voice-lab';

const title = '声线选择教程 — VR Standup';
const description =
  '学习如何从 Mosi 音色库选择 Voice ID、绑定演员，并生成一段安全的服务端 TTS 试听。';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    images: [],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: [],
  },
};

export default function VoicesPage() {
  return <VoiceLab />;
}
