'use client';
import { useEffect, useRef, useState } from 'react';
import { INITIAL_RECORDING, type RecordingCheck as Controller, type RecordingState } from '@/study/spikes/recording-check';
import { RECORDING_FILE_BYTES } from '@/study/spikes/recording-rules';
import { inspectXrSupport, xrErrorMessage, type XrSupport } from '@/study/spikes/xr-support';
import styles from '../replay/replay.module.css';

export function RecordingCheck() {
  const host = useRef<HTMLDivElement>(null), controller = useRef<Controller | null>(null);
  const [state, setState] = useState<RecordingState>(INITIAL_RECORDING);
  const [support, setSupport] = useState<XrSupport | null>(null), [operation, setOperation] = useState(false), [notice, setNotice] = useState('');
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true; let cancelled = false; let current: Controller | undefined;
    void import('@/study/spikes/recording-check').then(({ createRecordingCheck }) => {
      if (cancelled || !host.current) return;
      current = createRecordingCheck(host.current, next => { if (!cancelled) setState(next); }); controller.current = current;
    }).catch(() => { if (!cancelled) setNotice('三维画面无法创建，请确认 WebGL 2 可用后刷新页面。'); });
    void inspectXrSupport().then(value => { if (!cancelled) setSupport(value); });
    return () => { cancelled = true; alive.current = false; current?.dispose(); if (controller.current === current) controller.current = null; };
  }, []);
  const busy = operation || ['preparing', 'recording', 'stopping', 'playing'].includes(state.phase);
  async function act(action: () => Promise<void>) {
    if (operation) return; setOperation(true); setNotice('');
    try { await action(); } catch (error) { if (alive.current) setNotice(xrErrorMessage(error)); }
    finally { if (alive.current) setOperation(false); }
  }
  function download() {
    const take = controller.current?.take(); if (!take) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(take)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `punchcap-recording-check-${take.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('已发起本机下载。文件含你的声音和动作，请保存在本机私密位置；不会自动上传。');
  }
  async function load(file?: File) {
    if (!file || busy || state.inVR) return;
    if (file.size > RECORDING_FILE_BYTES) { setNotice('文件超过本轮 12 MiB 上限，未读取。'); return; }
    setOperation(true);
    try { const value: unknown = JSON.parse(await file.text()); if (alive.current) controller.current?.importTake(value); setNotice('已读取本机文件，没有上传。'); }
    catch (error) { if (alive.current) setNotice(error instanceof Error ? error.message : '文件无法读取。'); }
    finally { if (alive.current) setOperation(false); }
  }
  const summary = state.summary;
  return <section className={styles.check} aria-label="真实动作与声音录制检查">
    <div ref={host} className={styles.viewport} />
    <div className={styles.controls}>
      <p className={styles.status} role="status">{state.message}</p>
      <p className={styles.note}>准备时会请求麦克风。录制和文件读取都在当前浏览器内完成；停止后关闭麦克风。离开页面会清除尚未下载的片段。</p>
      <div className={styles.buttons}>
        <button disabled={busy || state.inVR} onClick={() => void act(async () => { await controller.current?.prepare(); })}>{summary ? '重新准备（清空本页片段）' : '准备麦克风'}</button>
        <button className={styles.primary} disabled={busy || state.inVR || state.phase !== 'ready' || !support?.supported} onClick={() => void act(async () => { await controller.current?.enterVR(); })}>进入 VR 录制</button>
        <button disabled={!state.inVR || operation || state.phase === 'stopping'} onClick={() => void act(async () => { await controller.current?.exitVR(); })}>退出 VR</button>
        <button disabled={state.inVR || !['ready', 'preparing'].includes(state.phase)} onClick={() => controller.current?.cancelPreparation()}>关闭麦克风并取消准备</button>
      </div>
      <p className={styles.note}>{support ? `${support.connection}；${support.message}` : '正在检查 VR 能力…'}</p>
      {state.inVR && <p>头显中看前方中文提示：第一次扣扳机校准，第二次开始，再次扣扳机停止。结束后再扣一次退出 VR。</p>}
      <dl className={styles.metrics}>
        <div><dt>进度</dt><dd>{(state.elapsedMs / 1000).toFixed(2)}<small> 秒</small></dd></div>
        <div><dt>动作帧</dt><dd>{state.frames}</dd></div>
        <div><dt>地面与朝向</dt><dd>{state.calibrated ? '已校准' : '待校准'}</dd></div>
        <div><dt>当前 VR</dt><dd>{state.inVR ? '已进入' : '未进入'}</dd></div>
      </dl>
      {summary && <div className={styles.result}>
        <h2>{summary.source === 'test-fixture' ? '测试文件已载入（非真实采集）' : summary.interrupted ? '本轮有中断，需复查' : '片段已保存到本页内存'}</h2>
        <p>{(summary.durationMs / 1000).toFixed(2)} 秒；{summary.frames} 帧；有效头部 {summary.head}、左手 {summary.left}、右手 {summary.right} 帧；其中 {summary.estimated} 帧含设备估算位置。</p>
        <p>声音均方根 {summary.rms.toFixed(5)}。请实际试听；数值不代表录音内容或物理同步通过。</p>
        <div className={styles.buttons}>
          <button disabled={busy || state.inVR} onClick={download}>下载录制文件</button>
          <button disabled={busy || state.inVR} onClick={() => void act(async () => { await controller.current?.play(); })}>{state.phase === 'paused' ? '继续回放' : '回放真实片段'}</button>
          <button disabled={state.phase !== 'playing'} onClick={() => controller.current?.pause()}>暂停回放</button>
        </div>
        <div className={styles.views} role="group" aria-label="录制片段观察角度">{(['front', 'left', 'right'] as const).map((view, i) => <button key={view} disabled={state.inVR} onClick={() => controller.current?.setView(view)}>{['正面', '左侧', '右侧'][i]}</button>)}</div>
      </div>}
      <label className={styles.note}>读取已下载的本机录制文件（不上传）<input type="file" accept=".json,application/json" disabled={busy || state.inVR} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void load(file); }} /></label>
      {notice && <p role="status">{notice}</p>}
    </div>
  </section>;
}
