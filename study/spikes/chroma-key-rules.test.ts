import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromaAlpha, DEFAULT_CHROMA, keyRGB, validateChroma } from './chroma-key-rules';

test('encoded key is fully removed while neutral and contrasting foreground survive', () => {
  assert.equal(chromaAlpha(keyRGB(DEFAULT_CHROMA), DEFAULT_CHROMA), 0);
  for (const rgb of [[0, 0, 0], [1, 1, 1], [0.9, 0.15, 0.2]] as const) {
    assert.equal(chromaAlpha(rgb, DEFAULT_CHROMA), 1);
  }
});
test('soft edges have partial alpha and a wider removal range cannot restore a pixel', () => {
  const key = keyRGB(DEFAULT_CHROMA);
  const rgb = [key[0], key[1] * 0.48, key[2]] as const;
  const alpha = chromaAlpha(rgb, DEFAULT_CHROMA);
  assert.ok(alpha > 0 && alpha < 1);
  assert.ok(chromaAlpha(rgb, { ...DEFAULT_CHROMA, similarity: 0.2 }) < alpha);
});
test('blue keys are supported and spill does not change the transparency mask', () => {
  const blue = { ...DEFAULT_CHROMA, keyColor: '#0000ff' };
  assert.equal(chromaAlpha([0, 0, 1], blue), 0);
  assert.equal(chromaAlpha([0, 1, 0], blue), 1);
  assert.equal(chromaAlpha([0.8, 0.3, 0.2], { ...blue, spill: 0 }), chromaAlpha([0.8, 0.3, 0.2], { ...blue, spill: 1 }));
});
test('invalid external parameters are rejected before shader updates', () => {
  for (const bad of [
    { keyColor: '#0f0' }, { keyColor: 'green' }, { similarity: NaN },
    { smoothness: 0 }, { smoothness: Infinity }, { spill: -0.1 }, { spill: 1.1 },
  ]) assert.throws(() => validateChroma({ ...DEFAULT_CHROMA, ...bad }));
  assert.deepEqual(validateChroma(DEFAULT_CHROMA), DEFAULT_CHROMA);
});
