import { NextResponse } from 'next/server';
import { TTSConfigurationError, TTSProviderError } from '@/server/tts/errors';
import { generateSpeech } from '@/server/tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TTSRequestBody = {
  text?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: { message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  let body: TTSRequestBody;
  try {
    body = (await request.json()) as TTSRequestBody;
  } catch {
    return errorResponse('请求体必须是有效 JSON。', 400);
  }

  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    return errorResponse('text 必须是非空字符串。', 400);
  }

  try {
    // Keep the caller's text intact so Moss pause markers such as
    // [pause 1.5s] reach the provider without rewriting or truncation.
    const result = await generateSpeech(body.text);
    return new Response(result.audio, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof TTSConfigurationError) {
      console.error('[tts] Configuration error', { message: error.message });
      return errorResponse(error.message, 503);
    }
    if (error instanceof TTSProviderError) {
      return errorResponse('语音服务暂时不可用，请稍后重试。', 502);
    }

    console.error('[tts] Unexpected server error', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    return errorResponse('语音生成失败。', 500);
  }
}
