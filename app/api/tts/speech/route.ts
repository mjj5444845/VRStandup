import { NextRequest, NextResponse } from 'next/server';
import { fetchMosi, MosiConfigurationError } from '../../../lib/tts/mosi';
import {
  checkRateLimit,
  getRequestClientId,
} from '../../../lib/tts/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED_MODELS = new Set(['moss-tts-1.5-flash', 'moss-tts-1.0-pro']);
const MAX_INPUT_LENGTH = 500;

type SpeechRequestBody = {
  input?: unknown;
  voiceId?: unknown;
  model?: unknown;
};

type MosiSpeechResult = {
  id?: string;
  status?: string;
  url?: string;
  response_format?: string;
  content_type?: string;
};

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `speech:${getRequestClientId(request)}`,
    6,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '试听次数过多，请稍后再试。' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: SpeechRequestBody;
  try {
    body = (await request.json()) as SpeechRequestBody;
  } catch {
    return NextResponse.json({ error: '请求内容不是有效 JSON。' }, { status: 400 });
  }

  const input = typeof body.input === 'string' ? body.input.trim() : '';
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
  const model =
    typeof body.model === 'string' ? body.model : 'moss-tts-1.5-flash';

  if (!input || input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `试听文本须为 1–${MAX_INPUT_LENGTH} 个字符。` },
      { status: 400 },
    );
  }
  if (!voiceId || voiceId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
    return NextResponse.json({ error: '请选择有效的 Voice ID。' }, { status: 400 });
  }
  if (!SUPPORTED_MODELS.has(model)) {
    return NextResponse.json({ error: '不支持该 TTS 模型。' }, { status: 400 });
  }

  try {
    const response = await fetchMosi('/v1/audio/speech', {
      method: 'POST',
      body: JSON.stringify({
        model,
        input,
        voice_id: voiceId,
        response_format: 'mp3',
        delivery_method: 'url',
        aigc_metadata: {
          enabled: true,
          content_propagator: 'VRStandup',
        },
      }),
    });
    const payload = (await response.json()) as MosiSpeechResult;

    if (!response.ok || !payload.url) {
      return NextResponse.json(
        { error: '语音生成失败，请检查音色或稍后重试。' },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json({
      id: payload.id ?? null,
      status: payload.status ?? 'SUCCESS',
      url: payload.url,
      responseFormat: payload.response_format ?? 'mp3',
      contentType: payload.content_type ?? 'audio/mpeg',
    });
  } catch (error) {
    const status = error instanceof MosiConfigurationError ? 503 : 502;
    return NextResponse.json(
      {
        error:
          error instanceof MosiConfigurationError
            ? error.message
            : 'Mosi 服务暂时不可用。',
      },
      { status },
    );
  }
}
