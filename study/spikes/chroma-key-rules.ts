export type ChromaSettings = {
  keyColor: string;
  similarity: number;
  smoothness: number;
  spill: number;
};
export type RGB = readonly [number, number, number];

// Both the CPU check and shader use these chroma-only projections of encoded RGB.
export const CB: RGB = [-0.168736, -0.331264, 0.5];
export const CR: RGB = [0.5, -0.418688, -0.081312];
export const DEFAULT_CHROMA: ChromaSettings = {
  keyColor: '#00b140', similarity: 0.16, smoothness: 0.08, spill: 0.65,
};

export function validateChroma(settings: ChromaSettings): ChromaSettings {
  if (!/^#[\da-f]{6}$/i.test(settings.keyColor)) throw new Error('背景颜色必须为六位颜色值。');
  for (const key of ['similarity', 'smoothness', 'spill'] as const) {
    const value = settings[key];
    if (!Number.isFinite(value) || value < 0 || value > 1 || (key === 'smoothness' && value < 0.001)) {
      throw new Error('参数必须在允许范围内，边缘柔和度不能为零。');
    }
  }
  return { ...settings };
}

/** Keep the key encoded: Three.Color would convert it to linear RGB too early. */
export function keyRGB(settings: ChromaSettings): RGB {
  validateChroma(settings);
  return [
    parseInt(settings.keyColor.slice(1, 3), 16) / 255,
    parseInt(settings.keyColor.slice(3, 5), 16) / 255,
    parseInt(settings.keyColor.slice(5, 7), 16) / 255,
  ];
}

function dot(a: RGB, b: RGB) { return a.reduce((sum, value, i) => sum + value * b[i], 0); }

/** Reference alpha for parameter tests, not a substitute for GPU/device checks. */
export function chromaAlpha(rgb: RGB, settings: ChromaSettings): number {
  const key = keyRGB(settings);
  const delta: RGB = [rgb[0] - key[0], rgb[1] - key[1], rgb[2] - key[2]];
  const distance = Math.hypot(dot(delta, CB), dot(delta, CR));
  const t = Math.max(0, Math.min(1, (distance - settings.similarity) / settings.smoothness));
  return t * t * (3 - 2 * t);
}
