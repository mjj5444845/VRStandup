import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engineeringPlan } from './engineering';
import { inspectCaptionDraft, validateCaptionDraft, type CaptionDraft } from './caption-draft';

function sample(): CaptionDraft {
  const clip = engineeringPlan().clips.find(c => c.kind === 'main')!;
  return { schema: 'punchcap-caption-draft-v1', id: 'example', durationMs: clip.durationMs, cues: clip.cues, components: clip.cues.filter(c => ['expressive', 'distancing'].includes(c.kind)).map(c => ({ cueId: c.id, expressiveTypes: c.kind === 'expressive' ? ['W5'] : [], represents: '工程状态', performance: '工程动作配合', imagination: '补足感觉', commentary: '旁观评论', renderer: 'png-plane', source: '项目工程图形，非正式刺激' })) };
}
test('component notes preserve condition permissions and never approve research', () => {
  const result = inspectCaptionDraft(sample());
  assert.equal(result.engineeringReady, true); assert.equal(result.researchReady, false);
  assert.equal(result.components[0].permissions.D.throw, false);
  assert.equal(result.components[1].permissions.C.throw, false);
  assert.equal(result.components[1].permissions.D.throw, true);
  const draft = sample(); draft.components[0].renderer = 'spatial'; draft.components[1].source = '';
  assert.equal(inspectCaptionDraft(draft).engineeringReady, false);
  draft.components[0].renderer = 'body-effect'; draft.cues[0].assetId = 'not-installed';
  draft.components[0].expressiveTypes = []; draft.components[0].performance = ''; draft.components[1].commentary = '';
  const invalid = inspectCaptionDraft(draft); assert.equal(invalid.components[0].issues.length, 3); assert.equal(invalid.components[1].issues.length, 2);
});
test('drafts reject mixed runtime modes, bad timing, unsupported anchors and orphaned components', () => {
  assert.throws(() => validateCaptionDraft({}));
  for (const change of [
    (d: CaptionDraft) => { d.cues[0].throwable = true; },
    (d: CaptionDraft) => { d.cues[0].endMs = 10000; },
    (d: CaptionDraft) => { d.components.pop(); },
    (d: CaptionDraft) => { d.components.push(d.components[0]); },
    (d: CaptionDraft) => { d.components[0].cueId = 'orphan'; },
  ]) { const draft = sample(); change(draft); assert.throws(() => validateCaptionDraft(draft)); }
  for (const patch of [{kind:'mixed'}, {anchor:'body'}, {atMs:-1}]) {
    const draft = sample(); Object.assign(draft.cues[0], patch); assert.throws(() => validateCaptionDraft(draft));
  }
});
