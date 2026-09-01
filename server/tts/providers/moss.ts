import { TTSProviderError } from '../errors';
import type {
  SpeechAudio,
  SpeechOptions,
  TTSConfig,
  TTSProvider,
} from '../types';

export class MossTTSProvider implements TTSProvider {
  constructor(private readonly config: TTSConfig) {}

  async generateSpeech(
    text: string,
    options: SpeechOptions = {},
  ): Promise<SpeechAudio> {
    let response: Response;
    try {
      response = await fetch(`${this.config.apiBaseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: text,
          voice_id: options.voiceId ?? this.config.voiceId,
          response_format: 'mp3',
          delivery_method: 'audio',
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'network_error';
      throw new TTSProviderError(`Moss TTS 请求失败（${reason}）。`);
    }

    if (!response.ok) {
      console.error('[tts] Moss provider rejected the request', {
        status: response.status,
      });
      throw new TTSProviderError(
        `Moss TTS 返回错误状态 ${response.status}。`,
        response.status,
      );
    }

    const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
    if (!contentType.toLowerCase().startsWith('audio/')) {
      throw new TTSProviderError('Moss TTS 未返回音频内容。');
    }

    return {
      audio: await response.arrayBuffer(),
      contentType,
    };
  }
}
