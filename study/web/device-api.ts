export { DEVICE_STEPS, DEVICE_TEST_VERSION, deviceClip, deviceObservations, deviceReport, deviceRequirements, observeDevice, orientationDistance, validateDeviceReport } from '../core/device-test';
export type { DeviceStep, DeviceObservations, DeviceDecision } from '../core/device-test';
export { CLUB_BASE, CLUB_CAPTIONS } from '../core/club-assets';
export { engineeringClip, engineeringClipId } from '../core/engineering';
export { inspectBrowser } from './browser-check';
export { verifyPublicAssets } from './asset-preflight';
import type { DeviceObservations, DeviceStep } from '../core/device-test';
export function deviceProgress(id: DeviceStep, s: DeviceObservations) {
  if (id === 'assets') return s.assets === 'pass' ? '素材校验已通过。请确认实际画面。' : '请点击“检查26份素材”。';
  if (id === 'view') return `进入VR ${s.xrEntries}次；头部样本${s.xrHeadSamples}；转头${s.headTurnDegrees.toFixed(0)}度；左手${s.leftInput ? '已识别' : '未识别'}，右手${s.rightInput ? '已识别' : '未识别'}。`;
  if (id === 'conditions') return `已在头显观测：${s.conditions.join('、') || '无'}。`;
  if (id === 'grab') return `抓取${s.grabs}次；双手拉伸${s.twoHandStretches}次。`;
  if (id === 'attach') return `自身挂载${s.attaches}次。`;
  if (id === 'response') return `投掷${s.throws}次；舞台落点${s.stageLands}次；完成回应${s.responses}/2；第三次限制${s.blockedThird ? '已观测' : '未观测'}。`;
  if (id === 'questionnaire') return `VR作答${s.answers}次。`;
  if (id === 'pause') return `系统菜单暂停${s.systemInterruptions}次；头显内继续播放${s.resumes}次。`;
  if (id === 'microphone') return `已收到${s.audioSegments}份录音，请试听确认自己的声音。`;
  if (id === 'performance') return `累计${(s.xrElapsedMs / 1000).toFixed(1)}秒XR帧率样本，刷新率${s.refreshHz ?? '未提供'}。`;
  if (id === 'reentry') return `已进入VR ${s.xrEntries}/2次，退出${s.xrExits}/2次。`;
  return '请在头显面板确认文字是否清楚。';
}
