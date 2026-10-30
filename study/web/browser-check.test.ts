import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBrowser } from './browser-check';

test('capability report reflects supported features without requesting an immersive session', async()=>{
  const report=await checkBrowser({secure:true,webgl2:()=>true,audio:true,xr:async()=>true});
  assert.deepEqual(report.checks.map(c=>c.status),['pass','pass','pass','pass']);
  assert.ok(!Number.isNaN(Date.parse(report.checkedAt)));
});
test('insecure connections suppress XR probing and missing graphics/audio are explicit',async()=>{
  const report=await checkBrowser({secure:false,webgl2:()=>false,audio:false,xr:async()=>{throw new Error('must not probe');}});
  assert.deepEqual(report.checks.map(c=>c.status),['blocked','blocked','blocked','blocked']);
});
test('ordinary desktop browsers may lack XR; errors and timeouts remain recoverable',async()=>{
  for (const xr of [undefined,async()=>false,async()=>{throw new Error('denied');},()=>new Promise<boolean>(()=>{})]) {
    const report=await checkBrowser({secure:true,webgl2:()=>{throw new Error('GPU');},audio:true,xr},1);
    assert.equal(report.checks[1].status,'blocked');assert.equal(report.checks[3].status,'unavailable');
  }
});
