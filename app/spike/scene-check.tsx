'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScenePreview } from '@/study/spikes/scene-preview';
import { inspectXrSupport, xrErrorMessage, type XrSupport } from '@/study/spikes/xr-support';
import styles from './spike.module.css';

type ViewState = {
  kind: 'loading' | 'running' | 'paused' | 'error';
  message: string;
};

const LOADING: ViewState = { kind: 'loading', message: '正在准备三维画面…' };

export function SceneCheck({ enableVR = false }: { enableVR?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ScenePreview | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>(LOADING);
  const [xrSupport, setXrSupport] = useState<XrSupport | null>(null);
  const [vrPhase, setVrPhase] = useState<'idle' | 'starting' | 'active' | 'ending'>('idle');
  const [vrMessage, setVrMessage] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let preview: ScenePreview | undefined;

    // Load browser-only rendering code after mounting, never during server render.
    void import('@/study/spikes/scene-preview')
      .then(({ createScenePreview }) => {
        // Strict Mode can unmount before the dynamic import finishes.
        if (cancelled) return;
        preview = createScenePreview(container, {
          enableVR,
          onFailure: (message) => {
            if (!cancelled) setView({ kind: 'error', message });
          },
          onVrEnded: () => {
            if (cancelled) return;
            setVrPhase('idle');
            setVrMessage('VR 已退出，可以重新进入。');
          },
        });
        previewRef.current = preview;
        preview.start();
        setView({ kind: 'running', message: '画面已就绪，方块正在转动。' });
        if (enableVR) {
          void inspectXrSupport().then((support) => {
            if (!cancelled) setXrSupport(support);
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        preview?.dispose();
        if (previewRef.current === preview) previewRef.current = null;
        setView({
          kind: 'error',
          message: '无法启动三维画面。请确认浏览器支持 WebGL 2，并已开启图形加速，再点击“重新加载”。',
        });
      });

    return () => {
      cancelled = true;
      preview?.dispose();
      if (previewRef.current === preview) previewRef.current = null;
    };
  }, [attempt, enableVR]);

  function toggleRotation() {
    const preview = previewRef.current;
    if (!preview) return;
    if (view.kind === 'running') {
      preview.stop();
      setView({ kind: 'paused', message: '已暂停，方块应保持不动。' });
    } else if (view.kind === 'paused') {
      preview.start();
      setView({ kind: 'running', message: '画面已就绪，方块正在转动。' });
    }
  }

  function reload() {
    setView(LOADING);
    setXrSupport(null);
    setVrPhase('idle');
    setVrMessage('');
    // Remount the engine through the effect cleanup rather than stacking canvases.
    setAttempt((value) => value + 1);
  }

  function toggleVR() {
    const preview = previewRef.current;
    if (!preview || !xrSupport?.supported || (vrPhase !== 'idle' && vrPhase !== 'active')) return;
    const exiting = vrPhase === 'active';
    setVrPhase(exiting ? 'ending' : 'starting');
    setVrMessage(exiting ? '正在退出 VR…' : '请按浏览器提示确认进入 VR…');
    // enterVR invokes requestSession immediately within this button's gesture.
    const operation = exiting ? preview.exitVR() : preview.enterVR();
    void operation.then(() => {
      if (previewRef.current !== preview) return;
      setVrPhase(exiting ? 'idle' : 'active');
      setVrMessage(exiting ? 'VR 已退出。' : '已进入 VR；也可以通过头显系统菜单退出。');
    }).catch((error: unknown) => {
      if (previewRef.current !== preview) return;
      setVrPhase('idle');
      setVrMessage(xrErrorMessage(error));
    });
  }

  return (
    <section className={styles.check} aria-label="三维显示检查">
      <div className={`${styles.viewport} ${enableVR ? styles.vrViewport : ''}`} ref={containerRef}>
        {view.kind === 'loading' && <p className={styles.overlay}>正在准备画面…</p>}
        {view.kind === 'error' && <p className={styles.overlay}>画面暂时不可用，请按下方提示重试。</p>}
      </div>
      <div className={styles.controls}>
        <p className={styles.status} role="status" aria-live="polite">{view.message}</p>
        <div className={styles.buttons}>
          <button
            type="button"
            onClick={toggleRotation}
            disabled={(view.kind !== 'running' && view.kind !== 'paused') || vrPhase !== 'idle'}
          >
            {view.kind === 'paused' ? '继续转动' : '暂停转动'}
          </button>
          <button type="button" onClick={reload} disabled={view.kind === 'loading' || vrPhase !== 'idle'}>
            重新加载
          </button>
        </div>
        {enableVR && (
          <div className={styles.vrCheck}>
            <h2>头显连接检查</h2>
            {xrSupport ? (
              <>
                <dl className={styles.diagnostics}>
                  <div><dt>访问方式</dt><dd>{xrSupport.connection}</dd></div>
                  <div><dt>安全环境</dt><dd>{xrSupport.secure ? '浏览器认可' : '尚未通过'}</dd></div>
                  <div><dt>VR 设备</dt><dd>{xrSupport.message}</dd></div>
                </dl>
                <button
                  type="button"
                  className={styles.vrButton}
                  onClick={toggleVR}
                  disabled={!xrSupport.supported || view.kind === 'error' || vrPhase === 'starting' || vrPhase === 'ending'}
                >
                  {vrPhase === 'active' ? '退出 VR' : vrPhase === 'starting' ? '正在进入…' : vrPhase === 'ending' ? '正在退出…' : '进入 VR'}
                </button>
                <p role="status" aria-live="polite" className={styles.vrMessage}>{vrMessage}</p>
                <details className={styles.browserDetails}>
                  <summary>排查问题时查看浏览器信息</summary>
                  <p>{xrSupport.browser}</p>
                </details>
              </>
            ) : <p>{view.kind === 'error' ? '请先恢复上方三维画面，再检查 VR 设备。' : '正在检查连接方式与 VR 设备…'}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
