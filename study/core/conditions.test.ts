import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canPlayResponse, captionPermissions, CONDITION_IDS, CONDITIONS, getCondition } from './conditions';

test('A–D implement the documented condition table and remain immutable', () => {
  assert.deepEqual(CONDITION_IDS.map(id => [...getCondition(id).captions]), [[], ['expressive'], ['distancing'], ['expressive', 'distancing']]);
  assert.deepEqual(CONDITION_IDS.map(id => [getCondition(id).grab, getCondition(id).throw, getCondition(id).attachSelf, getCondition(id).responses]), [[false,false,false,false], [true,false,false,false], [true,false,false,false], [true,true,true,true]]);
  assert.ok(Object.isFrozen(CONDITIONS)); assert.ok(Object.isFrozen(CONDITIONS.D)); assert.ok(Object.isFrozen(CONDITIONS.D.captions));
});
test('unknown and inherited condition names are rejected', () => {
  for (const value of [null, undefined, '', 'a', 'E', 1, {}, 'toString', '__proto__']) assert.throws(() => getCondition(value), /条件必须/);
});
test('hidden captions cannot be grabbed, thrown or attached', () => {
  for (const [id, kind] of [['A','expressive'], ['A','distancing'], ['B','distancing'], ['C','expressive']] as const) {
    assert.deepEqual(captionPermissions(id, { kind, throwable: true }), { visible: false, grab: false, throw: false, attach: false });
  }
});
test('throwing requires D, distancing mode and an explicitly throwable cue', () => {
  for (const id of CONDITION_IDS) for (const kind of ['expressive', 'distancing'] as const) for (const throwable of [true,false]) {
    assert.equal(captionPermissions(id, {kind,throwable}).throw, id === 'D' && kind === 'distancing' && throwable);
  }
  assert.equal(captionPermissions('B', {kind:'expressive',throwable:false}).grab, true);
  assert.equal(captionPermissions('C', {kind:'distancing',throwable:false}).grab, true);
});
test('attachment is restricted to the participant and D condition', () => {
  for (const id of CONDITION_IDS) for (const target of ['self','other'] as const) {
    assert.equal(captionPermissions(id,{kind:'distancing',throwable:true},target).attach,id === 'D' && target === 'self');
  }
});
test('only D can respond and at most twice per bit; invalid counters fail', () => {
  for (const id of CONDITION_IDS) for (const count of [0,1,2,3]) assert.equal(canPlayResponse(id,count),id === 'D' && count < 2);
  for(const count of [-1,0.5,NaN,Infinity]) assert.throws(()=>canPlayResponse('D',count),/非负整数/);
});
