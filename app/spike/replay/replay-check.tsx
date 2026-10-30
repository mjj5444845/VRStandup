'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReplayCheck as ReplayController, ReplayReport, ReplayState, View } from '@/study/spikes/replay-check';
const INITIAL_REPLAY: ReplayState = { phase: 'idle', message: '正在准备三维回放…', positionMs: 0, missing: [], markerCount: 0, maxSubmissionDelayMs: 0, maxFrameGapMs: 0, resumes: 0, interruptions: 0 };
import styles from './replay.module.css';
const jointLabels = { head: '头部', leftHand: '左手', rightHand: '右手' };
export function ReplayCheck() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReplayController | null>(null);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(INITIAL_REPLAY);
  const [view, setView] = useState<View>('front');
  const [report, setReport] = useState<ReplayReport | null>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let check: ReplayController | undefined;
    // Load browser-only rendering after mount; cancel late creation during cleanup.
    void import('@/study/spikes/replay-check').then(({ createReplayCheck }) => {
      if (cancelled) return;
      check = createReplayCheck(container, (next) => {
        if (cancelled) return;
        setState(next);
        if (next.phase === 'ended' || next.phase === 'paused') setReport(controller.current?.report() ?? null);
      });
      controller.current = check;
      setReady(true);
    }).catch(() => {
      if (cancelled) return;
      setState({ ...INITIAL_REPLAY, phase: 'error', message: '三维检查无法创建，请确认浏览器支持 WebGL 后重新加载。' });
    });
    return () => {
      cancelled = true;
      check?.dispose();
      if (controller.current === check) controller.current = null;
    };
  }, [revision]);
  function reload() {
    setReady(false); setReport(null); setView('front'); setState(INITIAL_REPLAY);
    setRevision((n) => n + 1);
  }
  function changeView(next: View) { controller.current?.setView(next); setView(next); }
  function play() { setReport(null); void controller.current?.play(); }
  function reset() { controller.current?.reset(); setReport(null); }
  function download() {
    const current = controller.current?.report();
    if (!current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `punchcap-replay-check-${Date.now()}.json`; link.click();
    // Allow the local browser download to start before releasing its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const active = state.phase === 'playing' || state.phase === 'starting';
  const failed = state.phase === 'error';
  return (
    <section className={styles.check} aria-label="三维动作与声音回放检查">
      <div ref={host} className={styles.viewport} />
      <div className={styles.controls}>
        <p className={styles.status} role="status" aria-live="polite">{state.message}</p>
        <div className={styles.buttons}>
          <button className={styles.primary} disabled={!ready || active || failed} onClick={play}>{state.phase === 'paused' ? '继续播放' : state.phase === 'ended' ? '再次播放' : '开始播放'}</button>
          <button disabled={!active} onClick={() => controller.current?.pause()}>暂停</button>
          <button disabled={!ready || failed} onClick={reset}>回到开头</button>
          <button disabled={active} onClick={reload}>重新加载检查</button>
        </div>
        <progress value={state.positionMs} max={12000} aria-label="动作片段播放进度" />
        <dl className={styles.metrics}>
          <div><dt>片段进度</dt><dd>{(state.positionMs / 1000).toFixed(2)}<small> / 12 秒</small></dd></div>
          <div><dt>节拍记录</dt><dd>{state.markerCount}<small> / 6 次</small></dd></div>
          <div><dt>最大画面提交延迟</dt><dd>{state.maxSubmissionDelayMs.toFixed(1)}<small> 毫秒</small></dd></div>
          <div><dt>最大绘制间隔</dt><dd>{state.maxFrameGapMs.toFixed(1)}<small> 毫秒</small></dd></div>
        </dl>
        <div className={styles.views} role="group" aria-label="观看角度">
          <span>观看角度</span>
          {([['front', '正面'], ['left', '左侧'], ['right', '右侧']] as const).map(([value, label]) => <button key={value} aria-pressed={view === value} disabled={!ready || failed} onClick={() => changeView(value)}>{label}</button>)}
        </div>
        <p className={styles.tracking} role="status">{state.missing.length ? `当前追踪缺失：${state.missing.map((joint) => jointLabels[joint]).join('、')}；对应测试点已隐藏。` : '当前头部和双手都有有效数据。'}</p>
        <p className={styles.note}>第 6 秒附近故意缺少一小段左手数据，用来检查缺失处理；蓝色是左手，金色是右手。每次节拍时，右手到达高点，上方圆灯短暂闪亮。</p>
        <p className={styles.note}>音频时钟负责播放进度。这里记录的是程序提交画面相对预定节拍的延迟，不是扬声器、显示屏或真实动作采集的延迟；目前不设研究通过阈值。</p>
        <p className={styles.note}>继续次数 {state.resumes}；后台或声音中断 {state.interruptions} 次。切到后台会暂停，回到前台后需点击继续。</p>
        {report && <div className={styles.result}>
          <h2>{report.reachedEnd ? '本轮回放已结束' : '本轮回放已暂停'}</h2>
          <p>绘制 {report.renderedFrames} 帧；{report.observedMissingLeftHand ? '已观察到左手缺失并隐藏。' : '本轮尚未经过左手缺失区间。'}记录用于检查程序，不能代替真实演员和头显验收。</p>
          <div className={styles.tableWrap}><table><caption>节拍与画面记录</caption><thead><tr><th>预定节拍（秒）</th><th>动作取样（秒）</th><th>画面提交（秒）</th><th>提交延迟（毫秒）</th></tr></thead><tbody>{report.markers.map((row) => <tr key={row.markerMs}><td>{(row.markerMs / 1000).toFixed(3)}</td><td>{(row.sampledAtMs / 1000).toFixed(3)}</td><td>{(row.submittedAtMs / 1000).toFixed(3)}</td><td>{row.submissionDelayMs.toFixed(2)}</td></tr>)}</tbody></table></div>
          <div className={styles.buttons}><button onClick={download}>下载本轮记录</button></div>
        </div>}
      </div>
    </section>
  );
}
