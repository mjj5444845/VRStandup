'use client';
import { useEffect, useRef, useState } from 'react';
import { createChromaPreview, type ChromaPreview } from '@/study/spikes/chroma-preview';
import { DEFAULT_CHROMA, type ChromaSettings } from '@/study/spikes/chroma-key-rules';
import { inspectXrSupport, xrErrorMessage, type XrSupport } from '@/study/spikes/xr-support';
import styles from './chroma.module.css';

const FIXTURE = '/study/checks/chroma/silhouette.mp4';
export function ChromaCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ChromaPreview | null>(null);
  const localUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const alive = useRef(false);
  const [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState<ChromaSettings>({ ...DEFAULT_CHROMA });
  const [background, setBackground] = useState('#293e50');
  const [message, setMessage] = useState('正在准备预览…');
  const [gpu, setGpu] = useState<number[]>([]);
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState('原创几何样片 · 8 秒循环，无声音');
  const [support, setSupport] = useState<XrSupport | null>(null);
  const [inVR, setInVR] = useState(false);
  const [requestingVR, setRequestingVR] = useState(false);
  const [vrMessage, setVrMessage] = useState('');

  useEffect(() => {
    const video = videoRef.current, host = hostRef.current;
    if (!video || !host) return;
    alive.current = true;
    generation.current++;
    if (!video.hasAttribute('src')) video.src = localUrl.current ?? FIXTURE;
    let cancelled = false;
    setAvailable(false);
    try {
      const preview = createChromaPreview(host, video, (failure) => {
        if (!cancelled) { setMessage(failure); setAvailable(false); }
      }, (active) => { if (!cancelled) setInVR(active); });
      previewRef.current = preview;
      setGpu(preview.gpuAlphas);
      setAvailable(true);
      setMessage('预览已准备，视频就绪后可点击播放。');
    } catch {
      setGpu([]);
      setMessage('预览创建失败，请确认浏览器支持 WebGL，或重新加载预览。');
    }
    void inspectXrSupport().then((result) => { if (!cancelled) setSupport(result); });
    return () => {
      cancelled = true; alive.current = false;
      video.pause(); previewRef.current?.dispose(); previewRef.current = null;
    };
  }, [revision]);
  useEffect(() => { previewRef.current?.update(settings); }, [settings, revision]);
  useEffect(() => { previewRef.current?.setBackground(background); }, [background, revision]);
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
      localUrl.current = null;
    };
  }, []);

  function loadSource(file?: File) {
    const video = videoRef.current;
    if (!video) return;
    generation.current++;
    video.pause();
    setReady(false); setPlaying(false);
    const old = localUrl.current;
    localUrl.current = file ? URL.createObjectURL(file) : null;
    video.src = localUrl.current ?? FIXTURE;
    video.load();
    if (old) URL.revokeObjectURL(old);
    setSource(file ? `本机视频：${file.name}（未上传）` : '原创几何样片 · 8 秒循环，无声音');
    setMessage('正在读取视频…');
  }
  async function play() {
    const video = videoRef.current;
    if (!video) return;
    const id = generation.current;
    try { await video.play(); }
    catch { if (alive.current && generation.current === id) setMessage('视频无法播放，请检查编码格式并再次点击播放。'); }
  }
  function reset() {
    setSettings({ ...DEFAULT_CHROMA }); setBackground('#293e50');
  }
  async function enterVR() {
    setRequestingVR(true); setVrMessage('正在请求进入 VR…');
    try {
      await previewRef.current?.enterVR();
      if (alive.current) setVrMessage('退出 VR 后可在原片区域重新播放或调整参数。');
    } catch (error) { if (alive.current) setVrMessage(xrErrorMessage(error)); }
    finally { if (alive.current) setRequestingVR(false); }
  }
  const sliders = [
    ['similarity', '去除范围', '数值越大，去掉的背景颜色越多。', 0, 1],
    ['smoothness', '边缘柔和度', '让半透明边缘过渡更平滑。', 0.001, 1],
    ['spill', '边缘去绿', '减轻边缘上的背景色反光。', 0, 1],
  ] as const;

  return (
    <section className={styles.check} aria-label="视频去背景检查">
      <div className={styles.comparison}>
        <div><h2>原片</h2><video ref={videoRef} src={FIXTURE} muted playsInline loop preload="auto" aria-label="原始视频"
          onLoadedMetadata={() => previewRef.current?.resizeVideo()}
          onCanPlay={() => { setReady(true); setMessage('视频已就绪，可以播放和调整。'); }}
          onPlay={() => { setPlaying(true); setMessage('正在播放，可对照两边检查轮廓和颜色。'); }}
          onPause={() => setPlaying(false)}
          onError={() => { setReady(false); setMessage('视频无法读取。请使用浏览器支持的 MP4（H.264）文件。'); }} />
        </div>
        <div><h2>去背景后的三维画面</h2><div ref={hostRef} className={styles.viewport} /></div>
      </div>
      <div className={styles.controls}>
        <p role="status" aria-live="polite" className={styles.status}>{message}</p>
        <p className={styles.note}>{source}</p>
        <div className={styles.buttons}>
          <button onClick={() => void play()} disabled={!ready || !available || playing}>播放</button>
          <button onClick={() => videoRef.current?.pause()} disabled={!playing}>暂停</button>
          <button onClick={() => loadSource()} disabled={inVR || requestingVR}>使用原创样片</button>
          <label className={styles.file}>选择本机视频<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={inVR || requestingVR}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) loadSource(file); event.currentTarget.value = ''; }} /></label>
        </div>
        <p className={styles.note}>本机视频仅在当前浏览器读取，不上传、不复制到公开目录；此项检查始终静音。</p>
        <fieldset className={styles.parameters} disabled={!available}>
          <legend>调整背景与边缘</legend>
          <label>要去掉的颜色<input aria-label="要去掉的颜色" type="color" value={settings.keyColor} onChange={(event) => setSettings({ ...settings, keyColor: event.target.value })} /><span>{settings.keyColor}</span></label>
          {sliders.map(([key, label, hint, min, max]) => <label key={key} className={styles.slider}>
            <span>{label}<output>{settings[key].toFixed(3)}</output></span>
            <input aria-label={label} type="range" min={min} max={max} step="0.001" value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} />
            <small>{hint}</small>
          </label>)}
          <label>预览底色<select aria-label="预览底色" value={background} onChange={(event) => setBackground(event.target.value)}><option value="#293e50">深蓝</option><option value="#eeeeee">浅灰</option><option value="#191919">近黑</option></select></label>
        </fieldset>
        <div className={styles.buttons}>
          <button onClick={reset}>恢复默认参数</button>
          <button disabled={inVR || requestingVR} onClick={() => setRevision((n) => n + 1)}>重新加载预览</button>
        </div>
        <details className={styles.details}><summary>查看参数与显卡检查</summary>
          <pre>{JSON.stringify(settings, null, 2)}</pre>
          <p>{gpu.length ? `默认参数的显卡色块检查通过：${gpu.join(' / ')}（0 为透明，255 为不透明；最后一项为柔和边缘）。` : '显卡检查尚未通过。'}</p>
          <p>参数仅保留在当前页面。以上色块检查验证显卡算法，不代表真实演员或头显效果通过。</p>
        </details>
        <div className={styles.vr}>
          <h2>在头显中查看</h2>
          <p>{support?.message ?? '正在检查设备能力…'}</p>
          <div className={styles.buttons}>
            <button disabled={!available || !ready || !support?.supported || inVR || requestingVR} onClick={() => void enterVR()}>进入 VR 查看</button>
            <button disabled={!inVR} onClick={() => void previewRef.current?.exitVR().catch(() => setVrMessage('退出失败，请使用头显系统菜单退出。'))}>退出 VR</button>
          </div>
          <p role="status">{vrMessage}</p>
          <p className={styles.note}>普通电脑上进入按钮保持灰色。头显需打开 HTTPS 地址，并先播放样片；这一步不检查“一次点击同时开启声音和 VR”。</p>
        </div>
      </div>
    </section>
  );
}
