import { CLUB_BASE } from '../core/club-assets';
import { assert, object, finite } from '../core/validation';
type Asset = { file: string; bytes: number; sha256: string };
export function publicAssetList(input: unknown): Asset[] {
  assert(object(input) && input.schema === 'punchcap-public-club-v1' && Array.isArray(input.files) && input.files.length === 26, '公开素材清单无效。');
  const ids = new Set<string>();
  for (const e of input.files) { assert(object(e) && typeof e.file === 'string' && /^(?:models\/[a-z0-9-]+\.glb|graphics\/[a-z-]+\.png|audio\/working\/[a-z-]+\.wav|fonts\/(?:NotoSansSC-Variable\.ttf|OFL\.txt)|rigs\/actor-mapping\.json|scene-layout\.json|lighting\.json)$/.test(e.file) && !ids.has(e.file) && finite(e.bytes) && e.bytes > 0 && e.bytes <= 64 * 1024 * 1024 && typeof e.sha256 === 'string' && /^[a-f0-9]{64}$/.test(e.sha256), '素材路径、大小或校验值无效。'); ids.add(e.file); }
  return input.files as Asset[];
}
/** User-triggered, same-origin verification; records contain no local filenames or credentials. */
export async function verifyPublicAssets(progress: (done: number, total: number) => void = () => {}, signal?: AbortSignal) {
  const r = await fetch(`${CLUB_BASE}/manifest.json`, { cache: 'no-cache', signal }); assert(r.ok, '素材清单未能下载。'); const entries = publicAssetList(await r.json()); let bytes = 0;
  for (let i = 0; i < entries.length; i++) { const e = entries[i], response = await fetch(`${CLUB_BASE}/${e.file}`, { cache: 'force-cache', signal }); assert(response.ok, `素材未能下载：${e.file}`); const data = await response.arrayBuffer(); assert(data.byteLength === e.bytes, `素材大小不符：${e.file}`); const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2, '0')).join(''); assert(hash === e.sha256, `素材校验失败：${e.file}`); bytes += data.byteLength; progress(i + 1, entries.length); }
  return { files: entries.length, bytes, checkedAt: new Date().toISOString(), scope: 'public-runtime-assets' };
}
