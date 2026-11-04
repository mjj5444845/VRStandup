import { CLUB_BASE } from '../core/club-assets';
import { assert } from '../core/validation';
import { publicAssetList } from '../core/public-assets';
export { publicAssetList } from '../core/public-assets';
/** User-triggered, same-origin verification; records contain no local filenames or credentials. */
export async function verifyPublicAssets(progress: (done: number, total: number) => void = () => {}, signal?: AbortSignal) {
  const r = await fetch(`${CLUB_BASE}/manifest.json`, { cache: 'no-cache', signal }); assert(r.ok, '素材清单未能下载。'); const entries = publicAssetList(await r.json()); let bytes = 0;
  for (let i = 0; i < entries.length; i++) { const e = entries[i], response = await fetch(`${CLUB_BASE}/${e.file}`, { cache: 'no-cache', signal }); assert(response.ok, `素材未能下载：${e.file}`); const data = await response.arrayBuffer(); assert(data.byteLength === e.bytes, `素材大小不符：${e.file}`); const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2, '0')).join(''); assert(hash === e.sha256, `素材校验失败：${e.file}`); bytes += data.byteLength; progress(i + 1, entries.length); }
  return { files: entries.length, bytes, checkedAt: new Date().toISOString(), scope: 'public-runtime-assets' };
}
