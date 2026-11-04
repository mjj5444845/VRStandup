import { CLUB_CAPTIONS } from './club-assets';
import { CONDITION_IDS, captionPermissions } from './conditions';
import { validateCues, type Cue } from './materials';
import { assert, finite, id, object, text } from './validation';

export const EXPRESSIVE_TYPES = ['W1', 'W2', 'W3', 'W4', 'W5'] as const;
export type CaptionComponent = {
  cueId: string; expressiveTypes: (typeof EXPRESSIVE_TYPES)[number][];
  represents: string; performance: string; imagination: string; commentary: string;
  renderer: 'png-plane' | 'spatial' | 'body-effect'; source: string;
};
export type CaptionDraft = {
  schema: 'punchcap-caption-draft-v1'; id: string; durationMs: number;
  cues: Cue[]; components: CaptionComponent[];
};

/** Content notes never grant runtime permissions or approve a research stimulus. */
export function validateCaptionDraft(input: unknown): CaptionDraft {
  assert(object(input) && input.schema === 'punchcap-caption-draft-v1' && id(input.id)
    && finite(input.durationMs) && input.durationMs > 0 && input.durationMs <= 180000
    && Array.isArray(input.components), '提示单格式、编号或片段时长无效。');
  const cues = validateCues(input.cues, input.durationMs);
  const captions = cues.filter(c => c.kind === 'expressive' || c.kind === 'distancing');
  const seen = new Set<string>();
  for (const component of input.components) {
    assert(object(component) && id(component.cueId) && !seen.has(component.cueId)
      && captions.some(c => c.id === component.cueId) && Array.isArray(component.expressiveTypes)
      && component.expressiveTypes.every(t => EXPRESSIVE_TYPES.includes(t))
      && new Set(component.expressiveTypes).size === component.expressiveTypes.length
      && ['png-plane', 'spatial', 'body-effect'].includes(String(component.renderer))
      && ['represents', 'performance', 'imagination', 'commentary', 'source'].every(k => typeof component[k] === 'string' && component[k].length <= 2000), '组件必须对应唯一花字，使用有效分类、渲染方式和文字说明。');
    seen.add(component.cueId);
  }
  assert(seen.size === captions.length, '每个花字必须有一份组件说明；混合事件请拆成写意和间离两项。');
  return { ...input, cues } as CaptionDraft;
}

export function inspectCaptionDraft(input: unknown) {
  const draft = validateCaptionDraft(input);
  const components = draft.components.map(component => {
    const cue = draft.cues.find(c => c.id === component.cueId)!;
    const kind = cue.kind === 'expressive' ? 'expressive' : 'distancing';
    const issues: string[] = [];
    if (component.renderer !== 'png-plane') issues.push('现有播放器只支持PNG平面；空间或身体特效尚未实现。');
    if (!CLUB_CAPTIONS.some(a => a.id === cue.assetId && a.kind === kind)) issues.push('图形编号或类别未接入当前播放器，需先制作并登记运行资产。');
    if (kind === 'expressive' && (!component.expressiveTypes.length || ![component.represents, component.performance, component.imagination].every(v => text(v.trim())))) issues.push('写意需填写分类、表征对象、表演协同和观众补足。');
    if (kind === 'distancing' && !text(component.commentary.trim())) issues.push('间离需说明评论立场或第二层读法。');
    if (!component.source.trim()) issues.push('需记录制作来源与许可依据。');
    return { cueId: cue.id, issues, permissions: Object.fromEntries(CONDITION_IDS.map(condition => [condition, captionPermissions(condition, { kind, throwable: cue.throwable })])) };
  });
  return {
    draft, components, engineeringReady: components.length > 0 && components.every(c => !c.issues.length), researchReady: false as const,
    pending: ['演员核对与逐字脚本', '真实声音、笑声和停顿及精确时机', '来源许可与原创制作审核', '可读性、遮挡和Quest实测', '研究负责人批准'],
  };
}
