import type { Evidence } from './execution';
import type { ConditionId } from './conditions';
import type { Quat } from './motion';
import { assert, object, finite } from './validation';
import { engineeringClip } from './engineering';
import { base64Bytes, pcmWave, validateRecording } from './recording';
import { validateCues } from './materials';
export const DEVICE_TEST_VERSION = '2026-11-03-device-v1';
export const DEVICE_STEPS = [
  { id: 'assets', title: '场景与素材', instruction: '等待素材检查完成，确认看到舞台、桌椅和人物。' },
  { id: 'view', title: '进入 VR 与转头', instruction: '点击进入 VR。自然左右转头，抬起左右手柄，并确认听到节拍。' },
  { id: 'chinese', title: '中文面板', instruction: '检查文字是否清楚、有无方块字。看得清再用射线选“确认通过并继续”。' },
  { id: 'conditions', title: '四种条件', instruction: '依次查看 A 无花字、B 写意、C 间离、D 两类花字。看清后再切下一种。' },
  { id: 'grab', title: '抓取与双手拉伸', instruction: '射线对准花字，按住扳机抓取；另一只手也抓住同一花字，缓慢拉开再松开。无需卡时间。' },
  { id: 'attach', title: '挂到自己身前', instruction: '抓住花字后按握把键，将它挂在自己身前。不要挂到其他观众身上。' },
  { id: 'response', title: '投掷与回应', instruction: '抓住间离花字，向舞台挥手并松开扳机。成功两次会播放回应；第三次落到舞台应不再回应。可重试。' },
  { id: 'questionnaire', title: 'VR 内作答', instruction: '用射线选择数值并提交，确认答案已被记录。这里是测试题目。' },
  { id: 'pause', title: '系统菜单与恢复', instruction: '打开 Quest 系统菜单，再返回。保护暂停后选择继续播放；若已退出VR，点进入VR再继续。确认声音和动作从原进度继续。' },
  { id: 'microphone', title: '麦克风与试听', instruction: '退出 VR，在网页准备测试麦克风。说一句话后结束，试听自己的录音并确认；可以不通过并继续。' },
  { id: 'performance', title: '完整场景表现', instruction: '回到 VR，自然观察。系统累计至少10秒实际帧率样本；确认画面是否流畅、坐姿是否舒适。' },
  { id: 'reentry', title: '退出与再次进入', instruction: '完成两次进入和退出 VR。最后退出后在网页下载总报告。' },
] as const;
export type DeviceStep = typeof DEVICE_STEPS[number]['id'];
export type DeviceObservations = {
  assets: 'pending' | 'pass' | 'fail'; xrEntries: number; xrExits: number; xrHeadSamples: number; headTurnDegrees: number;
  leftInput: boolean; rightInput: boolean; conditions: ConditionId[]; grabs: number; twoHandStretches: number; attaches: number;
  throws: number; stageLands: number; responses: number; blockedThird: number; answers: number; systemInterruptions: number; resumes: number;
  audioSegments: number; xrFrames: number; xrElapsedMs: number; refreshHz: number | null;
};
export function deviceObservations(): DeviceObservations { return { assets: 'pending', xrEntries: 0, xrExits: 0, xrHeadSamples: 0, headTurnDegrees: 0, leftInput: false, rightInput: false, conditions: [], grabs: 0, twoHandStretches: 0, attaches: 0, throws: 0, stageLands: 0, responses: 0, blockedThird: 0, answers: 0, systemInterruptions: 0, resumes: 0, audioSegments: 0, xrFrames: 0, xrElapsedMs: 0, refreshHz: null }; }
export function orientationDistance(a: Quat, b: Quat) { return 2 * Math.acos(Math.min(1, Math.abs(a.reduce((n, v, i) => n + v * b[i], 0)))) * 180 / Math.PI; }
export function observeDevice(previous: DeviceObservations, e: Evidence) {
  const s = { ...previous };
  if (e.kind === 'orientation') s.xrHeadSamples += e.samples.filter(p => p.source === 'xr' && p.head).length;
  if (e.kind === 'performance' && e.source === 'xr') { s.xrFrames += e.frames; s.xrElapsedMs += e.elapsedMs; if (e.refreshHz) s.refreshHz = e.refreshHz; }
  if (e.kind === 'interaction' && e.source === 'xr') { if (e.action === 'grab') s.grabs++; if (e.action === 'stretch' && e.inputCount === 2) s.twoHandStretches++; if (e.action === 'attach') s.attaches++; if (e.action === 'throw') s.throws++; if (e.action === 'land' && e.outcome === 'stage') s.stageLands++; }
  return s;
}
export type DeviceDecision = { status: 'pass' | 'fail' | 'skipped'; note: string };
export function deviceRequirements(id: DeviceStep, s: DeviceObservations): boolean {
  switch (id) {
    case 'assets': return s.assets === 'pass';
    // These are engineering detection amounts, not research criteria or reaction-time limits.
    case 'view': return s.xrEntries > 0 && s.xrHeadSamples >= 5 && s.headTurnDegrees >= 15 && s.leftInput && s.rightInput;
    case 'chinese': return s.xrEntries > 0;
    case 'conditions': return ['A', 'B', 'C', 'D'].every(c => s.conditions.includes(c as ConditionId));
    case 'grab': return s.grabs > 0 && s.twoHandStretches > 0;
    case 'attach': return s.attaches > 0;
    case 'response': return s.throws >= 3 && s.stageLands >= 3 && s.responses === 2 && s.blockedThird > 0;
    case 'questionnaire': return s.answers > 0;
    case 'pause': return s.systemInterruptions > 0 && s.resumes > 0;
    case 'microphone': return s.audioSegments > 0;
    case 'performance': return s.xrElapsedMs >= 10000 && s.xrFrames > 0 && s.refreshHz !== null && s.xrFrames * 1000 / s.xrElapsedMs >= s.refreshHz * .9;
    case 'reentry': return s.xrEntries >= 2 && s.xrExits >= 2;
  }
}
export function deviceReport(s: DeviceObservations, decisions: Partial<Record<DeviceStep, DeviceDecision>>) {
  const checks = DEVICE_STEPS.map(step => { const d = decisions[step.id], observed = deviceRequirements(step.id, s); return { id: step.id, title: step.title, automaticEvidence: observed, status: d?.status === 'pass' && !observed ? 'pending' : d?.status ?? 'pending', note: d?.note ?? '' }; });
  return { schema: 'punchcap-device-test-v1', version: DEVICE_TEST_VERSION, generatedAt: '', scope: 'Quest device acceptance; desktop rehearsal cannot pass XR checks', complete: checks.every(c => c.status === 'pass'), observations: s, checks, warnings: s.refreshHz === null ? ['浏览器未报告刷新率，不能据此判定刷新率90%目标。'] : [] };
}
export function validateDeviceReport(input: unknown) {
  assert(object(input) && input.schema === 'punchcap-device-test-v1' && input.version === DEVICE_TEST_VERSION && object(input.observations) && Array.isArray(input.checks), '不是此版本的设备测试报告。');
  const s = input.observations, initial = deviceObservations();
  for (const key of Object.keys(initial) as (keyof DeviceObservations)[]) {
    const v = s[key]; if (key === 'assets') assert(['pending', 'pass', 'fail'].includes(String(v)), '素材结果无效。');
    else if (key === 'conditions') assert(Array.isArray(v) && v.length <= 4 && new Set(v).size === v.length && v.every(c => ['A', 'B', 'C', 'D'].includes(c)), '条件记录无效。');
    else if (key === 'leftInput' || key === 'rightInput') assert(typeof v === 'boolean', '输入记录无效。');
    else if (key === 'refreshHz') assert(v === null || finite(v) && v > 0 && v <= 1000, '刷新率无效。');
    else assert(finite(v) && v >= 0 && v < 1e12, '观测值无效。');
  }
  const decisions: Partial<Record<DeviceStep, DeviceDecision>> = {};
  assert(input.checks.length === DEVICE_STEPS.length, '检查项不完整。');
  for (const step of DEVICE_STEPS) { const c = input.checks.find((c: unknown) => object(c) && c.id === step.id); assert(object(c) && ['pending', 'pass', 'fail', 'skipped'].includes(String(c.status)) && typeof c.note === 'string' && c.note.length <= 2000, '检查项无效。'); if (c.status !== 'pending') decisions[step.id] = { status: c.status as DeviceDecision['status'], note: c.note }; }
  return deviceReport(s as DeviceObservations, decisions);
}
/** Long, repeatable exercise windows remove any requirement to react within a few seconds. */
export function deviceClip(id: string, condition: ConditionId = 'D') {
  assert(/^[a-z-]{1,50}$/.test(id), '练习编号无效。'); const base = engineeringClip('club-flow-main1'), durationMs = 60000, rate = 8000, samples = new Float32Array(rate * durationMs / 1000);
  for (let i = 0; i < samples.length; i++) if (i % (rate * 2) < rate * .05) samples[i] = .08 * Math.sin(i / rate * 440 * 2 * Math.PI);
  const clipId = `device-${id}-${condition}`, frames = Array.from({ length: 6001 }, (_, i) => ({ ...base.take.frames[i % 1200], tMs: i * 10, predictedDisplayTimeMs: i * 10, observedPerformanceTimeMs: i * 10 }));
  const take = validateRecording({ ...base.take, id: clipId, durationMs, frames, audio: { ...base.take.audio, sampleRate: rate, frames: samples.length, wavBase64: base64Bytes(pcmWave(samples, rate)) } });
  const cues = validateCues([
    { id: 'expressive', kind: 'expressive', atMs: 0, endMs: 5000, anchor: 'rightHand', offset: [0, .4, 0], assetId: 'expressive-wow', throwable: false },
    { id: 'distancing', kind: 'distancing', atMs: 600, endMs: 5600, anchor: 'leftHand', offset: [0, .4, 0], assetId: 'distancing-plan', throwable: true },
    { id: 'window', kind: 'response-window', atMs: 0, endMs: durationMs, anchor: 'stage', offset: [0, 0, 0], assetId: '', throwable: false },
    { id: 'laugh', kind: 'laugh', atMs: 0, endMs: 2000, anchor: 'stage', offset: [0, 0, 0], assetId: 'laugh-short', throwable: false },
  ], durationMs);
  return { take, manifest: { ...base.manifest, id: clipId, takeId: clipId, kind: 'practice' as const, durationMs, cues, files: { ...base.manifest.files, audio: { ...base.manifest.files.audio, sampleRate: rate, frames: samples.length } } } };
}
