const DEFAULT_MOSI_API_BASE_URL = 'https://api.mosi.cn';

export class MosiConfigurationError extends Error {}

export function getMosiApiKey() {
  const apiKey = process.env.MOSS_API_KEY?.trim();
  if (!apiKey) {
    throw new MosiConfigurationError('Mosi TTS 尚未配置。');
  }
  return apiKey;
}

export async function fetchMosi(path: string, init: RequestInit = {}) {
  const baseUrl =
    process.env.MOSS_API_BASE_URL?.trim() || DEFAULT_MOSI_API_BASE_URL;
  const apiKey = getMosiApiKey();

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
}
