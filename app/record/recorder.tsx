'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_RECORDER, type RecorderState, type createRecorder } from '@/study/xr/recorder';
import { createRecorderAudio, createPlaybackAudio } from '@/study/web/recorder-audio';
import { readRecording, RECORDING_FILE_BYTES, type RecordedTake } from '@/study/core/recording';
import { downloadJson } from '@/study/web/download-json';
import { recordingStopLabel } from '@/study/web/pcm-capture';
import { REFERENCE_MAPPING } from '@/study/core/demo';
import { validateMapping } from '@/study/core/materials';
type Runtime = ReturnType<typeof createRecorder>;
export function Recorder() {
  const host = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null);
  const [state, setState] = useState<RecorderState>(EMPTY_RECORDER), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [review, setReview] = useState<RecordedTake | null>(null);
  useEffect(() => { let stopped = false; let current: Runtime | undefined; void import('@/study/xr/recorder').then(({ createRecorder }) => { if (stopped || !host.current) return; current = createRecorder(host.current, createRecorderAudio(), setState); runtime.current = current; }).catch(e => { if (!stopped) setNotice(String(e)); }); return () => { stopped = true; current?.dispose(); runtime.current = null; }; }, []);
  async function act(run: () => Promise<void>) { setBusy(true); setNotice(''); try { await run(); } catch (e) { setNotice(e instanceof Error ? e.message : '操作失败'); } finally { setBusy(false); } }
  const active = ['recording', 'stopping', 'preparing'].includes(state.phase);
  return <><section className="work-card"><div ref={host} style={{ height: 360, width: '100%' }}/><p role="status">{state.message}</p><p>进度 {(state.elapsedMs / 1000).toFixed(2)} 秒 · {state.frames} 帧 · {state.calibrated ? '已校准' : '待校准'} · 麦克风{state.microphoneActive ? '已开启' : '已关闭'}</p><div className="work-actions">
    <button disabled={busy || active || state.inVR} onClick={() => void act(async () => { await runtime.current?.prepare(); })}>{state.take ? '重新准备（先保存原件）' : '准备麦克风'}</button>
    <button disabled={busy || state.phase !== 'ready' || state.inVR} onClick={() => void act(async () => { await runtime.current?.enter(); })}>进入 VR</button>
    <button disabled={!state.inVR || state.phase === 'stopping'} onClick={() => void act(async () => { await runtime.current?.exit(); })}>退出 VR</button>
    <button disabled={state.inVR || !['preparing', 'ready'].includes(state.phase)} onClick={() => runtime.current?.cancel()}>取消并关闭麦克风</button>
  </div>{state.take && <div><h2>{state.take.interrupted ? '有中断，仅供复查' : '原件已生成'}</h2><p>{recordingStopLabel(state.take.stopReason)}；估算位置与缺失姿态原样保留，不能仅凭完成录制认定物理同步合格。</p><button disabled={state.inVR} onClick={() => downloadJson(`punchcap-take-${state.take!.id}.json`, state.take)}>下载录制原件</button> <button disabled={state.inVR} onClick={() => setReview(state.take)}>回放复查</button></div>}<p className="work-small">先下载再刷新或重新准备。页面关闭不会自动备份原件；不会自动上传声音或动作。</p><p role="status">{notice}</p></section>
    <section className="work-card"><h2>读取本机原件</h2><p>支持本页格式及前期检查页导出的原件，读取时校验声音和动作。仅在当前浏览器内处理。</p><input type="file" accept=".json,application/json" disabled={state.inVR || active} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > RECORDING_FILE_BYTES) { setNotice('原件超过 128 MiB 工程上限。'); return; } void act(async () => { setReview(readRecording(JSON.parse(await file.text()))); }); }}/></section>
    {review && <Review take={review}/>}</>;
}
function Review({ take }: { take: RecordedTake }) {
  const host = useRef<HTMLDivElement>(null), currentTake = useRef(take), controller = useRef<ReturnType<typeof import('@/study/xr/review').createReview> | null>(null);
  const [message, setMessage] = useState('正在载入…'), [progress, setProgress] = useState(0), [playing, setPlaying] = useState(false);
  const [mapping, setMapping] = useState(JSON.stringify(REFERENCE_MAPPING, null, 2));
  const quality = useMemo(() => ({ head: take.frames.filter(f => f.head).length, left: take.frames.filter(f => f.leftHand).length, right: take.frames.filter(f => f.rightHand).length, estimated: take.frames.filter(f => [f.head, f.leftHand, f.rightHand].some(p => p?.emulatedPosition)).length }), [take]);
  useEffect(() => { let stopped = false; let runtime: typeof controller.current; void import('@/study/xr/review').then(async ({ createReview }) => { if (stopped || !host.current) return; runtime = createReview(host.current, createPlaybackAudio(), state => { if (!stopped) { setMessage(state.message); setProgress(state.progressMs); setPlaying(state.playing); } }); controller.current = runtime; await runtime.load(currentTake.current); }).catch(e => { if (!stopped) setMessage(String(e)); }); return () => { stopped = true; runtime?.dispose(); controller.current = null; }; }, []);
  useEffect(() => { currentTake.current = take; if (controller.current) void controller.current.load(take).catch(e => setMessage(String(e))); }, [take]);
  return <section className="work-card"><h2>动作与声音复查</h2><p>{take.source === 'test-fixture' ? '工程生成样例，不是真实演员' : '真实设备原件'} · {take.interrupted ? '本轮有中断' : '没有中断标记'} · 总长 {(take.durationMs / 1000).toFixed(2)} 秒</p><p>有效姿态：头部 {quality.head}/{take.frames.length}、左手 {quality.left}/{take.frames.length}、右手 {quality.right}/{take.frames.length}；其中含设备估算位置 {quality.estimated} 帧。</p><div ref={host} style={{ height: 360 }}/><p role="status">{message} · {(progress / 1000).toFixed(2)} 秒</p><button disabled={playing} onClick={() => void controller.current?.play().catch(e => setMessage(String(e)))}>播放 / 继续</button> <button disabled={!playing} onClick={() => controller.current?.pause()}>暂停</button>{(['front', 'left', 'right'] as const).map((side, i) => <button key={side} onClick={() => controller.current?.view(side)}>{['正面', '左侧', '右侧'][i]}</button>)}<details><summary>检查候选演员模型与头手映射</summary><p>只在本机读取自包含基础 GLB。先填写模型版本、头部参考高度和准确节点名称；直接驱动不等于完整人体 IK。</p><textarea aria-label="模型映射" value={mapping} onChange={e => setMapping(e.target.value)} style={{ width: '100%', minHeight: 160 }}/><input aria-label="候选演员 GLB" type="file" accept=".glb" disabled={playing} onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 64 * 1024 * 1024) { setMessage('模型超过 64 MiB 工程上限'); return; } void f.arrayBuffer().then(bytes => controller.current?.model(bytes, validateMapping(JSON.parse(mapping)))).catch(e => setMessage(String(e))); }}/></details><p className="work-small">此预览是头部和双手目标；正式人体、IK、穿模与头显物理同步分别验收。</p></section>;
}
