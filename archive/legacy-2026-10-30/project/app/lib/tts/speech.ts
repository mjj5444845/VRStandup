export async function requestSpeech(text: string): Promise<Blob> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const fallback = `语音请求失败（${response.status}）`;
    let message = fallback;
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      message = payload.error?.message ?? fallback;
    } catch {}
    throw new Error(message);
  }

  return response.blob();
}

export async function playSpeech(blob: Blob): Promise<HTMLAudioElement> {
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  const releaseObjectUrl = () => URL.revokeObjectURL(objectUrl);
  audio.addEventListener('ended', releaseObjectUrl, { once: true });
  audio.addEventListener('error', releaseObjectUrl, { once: true });

  try {
    await audio.play();
    return audio;
  } catch (error) {
    releaseObjectUrl();
    throw error;
  }
}

export async function speak(text: string): Promise<HTMLAudioElement> {
  return playSpeech(await requestSpeech(text));
}
