export type TTSProviderName = 'moss';

export type TTSConfig = {
  provider: TTSProviderName;
  apiKey: string;
  model: string;
  voiceId: string;
  apiBaseUrl: string;
};

export type SpeechOptions = {
  voiceId?: string;
};

export type SpeechAudio = {
  audio: ArrayBuffer;
  contentType: string;
};

export type TTSProvider = {
  generateSpeech(text: string, options?: SpeechOptions): Promise<SpeechAudio>;
};
