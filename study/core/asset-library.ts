import { validateManifest, type ClipManifest } from './materials';
import { assert, id, object, text } from './validation';
export type AssetLibraryEntry = { id: string; valid: boolean; error?: string; manifest?: ClipManifest };
export function validateAssetLibrary(input: unknown): AssetLibraryEntry[] {
  assert(Array.isArray(input) && input.length <= 10000, '素材列表格式或数量无效。');
  const seen = new Set<string>();
  return input.map(item => {
    assert(object(item) && id(item.id) && !seen.has(item.id) && typeof item.valid === 'boolean', '素材编号或校验状态无效。'); seen.add(item.id);
    if (!item.valid) { assert(text(item.error), '损坏素材缺少错误说明。'); return { id: item.id, valid: false, error: item.error }; }
    const manifest = validateManifest(item.manifest); assert(manifest.id === item.id, '素材编号与清单不一致。');
    return { id: item.id, valid: true, manifest };
  });
}
