import { engineeringPlan } from '../core/engineering';
import { syntheticTake } from '../core/synthetic-take';
import { readBundle, saveBundle } from './assets';
import { assert, canonicalJson } from '../core/validation';
export async function prepareEngineering(root: string) {
  const plan = engineeringPlan();
  for (let i = 0; i < plan.clips.length; i++) {
    const c = plan.clips[i];
    try { const found = (await readBundle(root, c.id)).manifest; assert(canonicalJson(found.cues) === canonicalJson(c.cues) && found.model.id === c.model.id, '已有工程素材与当前定义不符，请保留原件并使用新版本编号。'); plan.clips[i] = found; }
    catch (e) { if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e; plan.clips[i] = await saveBundle(root, syntheticTake(c.id), c); }
  }
  return plan;
}
