import { NextRequest, NextResponse } from 'next/server';
import { fetchMosi, MosiConfigurationError } from '../../../lib/tts/mosi';
import {
  checkRateLimit,
  getRequestClientId,
} from '../../../lib/tts/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MosiVoice = {
  id: string;
  name?: string;
  created_at?: number;
};

type MosiVoiceList = {
  data?: MosiVoice[];
  has_more?: boolean;
  next_cursor?: string;
};

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `voices:${getRequestClientId(request)}`,
    20,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试。' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 50;

  try {
    const response = await fetchMosi(
      `/v1/audio/voices?limit=${limit}&status=ready`,
      { method: 'GET' },
    );
    const payload = (await response.json()) as MosiVoiceList;

    if (!response.ok) {
      return NextResponse.json(
        { error: '暂时无法获取可用音色。' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      voices: (payload.data ?? []).map((voice) => ({
        id: voice.id,
        name: voice.name || '未命名音色',
        createdAt: voice.created_at ?? null,
      })),
      hasMore: Boolean(payload.has_more),
      nextCursor: payload.next_cursor ?? null,
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
