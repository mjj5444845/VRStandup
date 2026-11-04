import { assert, object, finite } from './validation';
type Asset = { file: string; bytes: number; sha256: string };
export function publicAssetList(input: unknown): Asset[] {
  assert(object(input) && input.schema === 'punchcap-public-club-v1' && Array.isArray(input.files) && input.files.length === 26, '公开素材清单无效。');
  const ids = new Set<string>();
  for (const e of input.files) { assert(object(e) && typeof e.file === 'string' && /^(?:models\/[a-z0-9-]+\.glb|graphics\/[a-z-]+\.png|audio\/working\/[a-z-]+\.wav|fonts\/(?:NotoSansSC-Variable\.ttf|OFL\.txt)|rigs\/actor-mapping\.json|scene-layout\.json|lighting\.json)$/.test(e.file) && !ids.has(e.file) && finite(e.bytes) && e.bytes > 0 && e.bytes <= 64 * 1024 * 1024 && typeof e.sha256 === 'string' && /^[a-f0-9]{64}$/.test(e.sha256), '素材路径、大小或校验值无效。'); ids.add(e.file); }
  return input.files as Asset[];
}
