'use client';

import { useEffect, useRef, useState } from 'react';
import { createMediaCheck, INITIAL_MEDIA } from '@/study/spikes/media-check';
import styles from './media.module.css';

export function MediaCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const checkerRef = useRef<ReturnType<typeof createMediaCheck> | null>(null);
  const [state, setState] = useState(INITIAL_MEDIA);
  useEffect(() => {
    if (!videoRef.current) return;
    const checker = createMediaCheck(videoRef.current, setState);
    checkerRef.current = checker;
    return () => {
      checker.dispose();
      if (checkerRef.current === checker) checkerRef.current = null;
    };
  }, []);
  const busy = state.phase === 'starting' || state.phase === 'playing';
  const report = state.report;
  const seconds = (Math.min(60_000, state.elapsedMs) / 1000).toFixed(1);
  const perSecond = report?.samples.filter((sample, index, samples) => index === 0
    || Math.floor(sample.audioMs / 1000) > Math.floor(samples[index - 1].audioMs / 1000));

  function prepare() {
    void checkerRef.current?.prepare().catch(() => {
      setState((previous) => ({ ...previous, phase: 'error', message: '浏览器未能创建声音环境，请确认支持 Web Audio 后重试。' }));
    });
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `punchcap-media-check-${report.createdAt.replace(/[:.]/g, '-')}.json`;
    link.click();
    // Revoke after the browser has started the local download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className={styles.check} aria-label="音画同步检查">
      {/* Muted video is intentional: only the Web Audio source may produce sound. */}
      <video ref={videoRef} className={styles.video} muted playsInline preload="auto" aria-label="每秒闪烁并显示计时数字的测试画面" />
      <div className={styles.content}>
        <p className={styles.status} role="status" aria-live="polite">{state.message}</p>
        <div className={styles.buttons}>
          <button onClick={prepare} disabled={busy || state.phase === 'preparing'}>{state.phase === 'preparing' ? '正在准备…' : state.phase === 'idle' ? '准备素材' : '重新准备'}</button>
          <button className={styles.primary} onClick={() => checkerRef.current?.start()} disabled={state.phase !== 'ready'}>开始 60 秒检查</button>
          <button onClick={() => checkerRef.current?.stop()} disabled={!busy}>停止</button>
        </div>
        <progress className={styles.progress} max={60_000} value={Math.min(60_000, state.elapsedMs)} aria-label="本次连续播放进度" />
        <dl className={styles.metrics}>
          <div><dt>已播放</dt><dd>{seconds}<small> / 60 秒</small></dd></div>
          <div><dt>当前偏差</dt><dd>{state.driftMs.toFixed(1)}<small> 毫秒</small></dd></div>
          <div><dt>最大绝对偏差</dt><dd>{state.maxAbsMs.toFixed(1)}<small> 毫秒</small></dd></div>
          <div><dt>画面速度</dt><dd>{state.rate.toFixed(2)}<small> 倍</small></dd></div>
        </dl>
        <p className={styles.hint}>采样方式：{state.method === 'video-frame-callback' ? '逐帧回调（浏览器支持）' : state.method === 'video-current-time' ? '视频时间读取（浏览器不支持逐帧回调）' : '准备后显示'}。已记录 {state.sampleCount} 次采样。</p>
        <p className={styles.hint}>保持这个页面在前台；切到后台、中途停止或缓冲中断，都会记为未完成。</p>
        {report && (
          <div className={styles.result}>
            <h2>{report.verdict === 'pass' ? '本次本机检查通过' : report.verdict === 'fail' ? '本次未达到标准' : '本次检查未完成'}</h2>
            <p>原始采样 {report.samples.length} 次；最大采样间隔 {report.maxSampleGapMs.toFixed(1)} 毫秒；大偏差跳转 {report.seekCount} 次。</p>
            <div className={styles.buttons}><button onClick={download}>下载本次检查记录</button></div>
            <details>
              <summary>查看每秒记录与测量方法</summary>
              <p>通过音频环境计时，以逐帧回调的视频时间优先测量；不支持时读取 video.currentTime。原始最大值包含启动、调速和跳转前的异常值，没有减去基线。准备阶段的视频播放确认后开始音频计时，音频启动时的视频位置为 {report.firstVideoMs.toFixed(1)} 毫秒。</p>
              <p>250 毫秒的采样空档保护用于识别浏览器停顿，不能替代或放宽 40 毫秒的研究标准。下载文件包含全部逐帧采样；这里每秒展示一行，便于阅读。</p>
              <div className={styles.tableWrap}><table><caption>每秒首个采样</caption><thead><tr><th>音频时间（秒）</th><th>视频时间（秒）</th><th>偏差（毫秒）</th><th>速度</th></tr></thead><tbody>
                {perSecond?.map((sample) => <tr key={sample.audioMs}><td>{(sample.audioMs / 1000).toFixed(3)}</td><td>{(sample.videoMs / 1000).toFixed(3)}</td><td>{sample.driftMs.toFixed(2)}</td><td>{sample.rate}</td></tr>)}
              </tbody></table></div>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}
