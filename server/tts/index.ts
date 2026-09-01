import { loadTTSConfig } from './config';
import { MossTTSProvider } from './providers/moss';
import type { SpeechAudio, SpeechOptions, TTSProvider } from './types';

async function createProvider(): Promise<TTSProvider> {
  const config = await loadTTSConfig();

  switch (config.provider) {
    case 'moss':
      return new MossTTSProvider(config);
  }
}

export async function generateSpeech(
  text: string,
  options?: SpeechOptions,
): Promise<SpeechAudio> {
  const provider = await createProvider();
  return provider.generateSpeech(text, options);
}
