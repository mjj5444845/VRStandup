import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TTSConfigurationError } from './errors';
import type { TTSConfig } from './types';

const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'config', 'tts.local.json');
const DEFAULT_API_BASE_URL = 'https://api.mosi.cn';

function requiredString(
  source: Record<string, unknown>,
  field: keyof TTSConfig,
): string {
  const value = source[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TTSConfigurationError(`TTS 配置缺少有效的 ${field}。`);
  }
  return value.trim();
}

export function validateTTSConfig(source: unknown): TTSConfig {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TTSConfigurationError('TTS 配置必须是 JSON 对象。');
  }

  const record = source as Record<string, unknown>;
  const provider = requiredString(record, 'provider');
  if (provider !== 'moss') {
    throw new TTSConfigurationError(`暂不支持 TTS provider：${provider}。`);
  }

  const apiBaseUrl =
    typeof record.apiBaseUrl === 'string' && record.apiBaseUrl.trim()
      ? record.apiBaseUrl.trim().replace(/\/$/, '')
      : DEFAULT_API_BASE_URL;

  try {
    new URL(apiBaseUrl);
  } catch {
    throw new TTSConfigurationError('TTS 配置中的 apiBaseUrl 不是有效 URL。');
  }

  return {
    provider,
    apiKey: requiredString(record, 'apiKey'),
    model: requiredString(record, 'model'),
    voiceId: requiredString(record, 'voiceId'),
    apiBaseUrl,
  };
}

function configFromEnvironment(): Record<string, string> | null {
  const apiKey = process.env.MOSS_API_KEY;
  const voiceId = process.env.MOSS_VOICE_ID;
  if (!apiKey && !voiceId) return null;

  return {
    provider: 'moss',
    apiKey: apiKey ?? '',
    model: process.env.MOSS_TTS_MODEL ?? 'moss-tts-1.5-flash',
    voiceId: voiceId ?? '',
    apiBaseUrl: process.env.MOSS_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  };
}

export async function loadTTSConfig(): Promise<TTSConfig> {
  const environmentConfig = configFromEnvironment();
  if (environmentConfig) return validateTTSConfig(environmentConfig);

  let contents: string;
  try {
    contents = await readFile(LOCAL_CONFIG_PATH, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new TTSConfigurationError(
        'TTS 尚未配置。请复制 config/tts.example.json 为 config/tts.local.json，并只在本机填写密钥。',
      );
    }
    throw new TTSConfigurationError('无法读取本地 TTS 配置。');
  }

  try {
    return validateTTSConfig(JSON.parse(contents));
  } catch (error) {
    if (error instanceof TTSConfigurationError) throw error;
    throw new TTSConfigurationError('config/tts.local.json 不是有效 JSON。');
  }
}
