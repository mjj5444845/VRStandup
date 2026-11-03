'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSceneAudio } from '@/study/web/scene-audio';
import { createMeasurementRecorder, type AudioSegment } from '@/study/web/measurement-audio';
import { contextKey, mediaContext, reportStatus, type Session, type Evidence, type RunClip, type ScenePanel } from '@/study/web/runtime-api';
import { downloadJson } from '@/study/web/download-json';
import type { createTheatre } from '@/study/xr/theatre';
import { RunQuestionnaire } from './questionnaire';
type Engine = ReturnType<typeof createTheatre>;
type Props = { session: Session; blocked: boolean; capture: (e: Evidence) => void; loadClip: (id: string) => Promise<RunClip>; advance?: () => void; resume?: () => void; report: () => Promise<unknown>; onAudioReady?: (ready: boolean) => void; saveAudio?: (segment: AudioSegment) => Promise<unknown> };
export function RunView(props: Props) {
  const { session, blocked, advance, resume } = props, host = useRef<HTMLDivElement>(null), latest = useRef(props), audio = useRef<ReturnType<typeof createSceneAudio> | null>(null), mic = useRef<ReturnType<typeof createMeasurementRecorder> | null>(null);
  const engineRef = useRef<Engine | null>(null), [engine, setEngine] = useState<Engine | null>(null), [armed, setArmed] = useState(false), [notice, setNotice] = useState(''), [audioNotice, setAudioNotice] = useState('实验麦克风未启用。'), [segments, setSegments] = useState<AudioSegment[]>([]), [micReady, setMicReady] = useState(false), [report, setReport] = useState<unknown>(null);
  const [view, setView] = useState({ ready: false, playing: false, progressMs: 0, message: '正在建立 Soft Clay Club 场景。', fps: 0, drawCalls: 0, captions: [] as { id: string; kind: string; held: boolean; throwable: boolean }[] });
  const applied = useRef({ key: '', stage: '', armed: false }), clipCache = useRef(new Map<string, RunClip>()), loadSerial = useRef(0), sceneLoaded = useRef('');
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    let disposed = false;
    const recorder = createMeasurementRecorder(setAudioNotice, segment => {
      setSegments(values => [...values, segment]); const saver = latest.current.saveAudio;
      if (saver) void saver(segment).then(() => { recorder.confirmed(segment.metadata.id); setSegments(values => values.filter(s => s.metadata.id !== segment.metadata.id)); setAudioNotice('实验录音已确认保存到本机私密目录。'); }).catch(e => setAudioNotice(String(e)));
    }); mic.current = recorder;
    void import('@/study/xr/theatre').then(({ createTheatre }) => {
      if (disposed || !host.current) return; const a = createSceneAudio(); audio.current = a;
      const scene = createTheatre(host.current, a, {
        changed: info => {
          if (disposed) return; setView(info);
          const s = latest.current.session, context = mediaContext(s), m = mic.current;
          if (info.playing && s.execution?.audioRequired && !m?.available()) { engineRef.current?.pause(); latest.current.onAudioReady?.(false); setMicReady(false); latest.current.capture({ kind: 'interruption', reason: 'required-microphone-unavailable' }); return; }
          if (info.playing && context && m?.available() && !m.recording()) {
            const main = s.plan.assignments.find(a => a.participantId === s.participantId)!.rounds[s.roundIndex].clipId;
            try { m.begin({ sessionId: s.id, participantId: s.participantId, round: s.roundIndex, clipId: context.phase === 'practice' ? context.clipId : main }, { elapsedMs: 0, context, mediaMs: info.progressMs }); } catch (e) { setAudioNotice(String(e)); }
          }
        },
        evidence: e => {
          if (disposed || latest.current.blocked) return;
          if (e.kind === 'media') { mic.current?.mark({ elapsedMs: 0, context: e.context, mediaMs: e.positionMs }); if (e.ended && e.context.phase !== 'response') mic.current?.stop('media-ended'); }
          latest.current.capture(e);
          if (e.kind === 'interaction' && e.action === 'land' && e.outcome === 'stage') {
            const s = latest.current.session, clip = s.plan.clips.find(c => c.id === e.context.clipId), round = s.plan.assignments.find(a => a.participantId === s.participantId)!.rounds[s.roundIndex];
            return round.condition === 'D' && s.responseCount < 2 && Boolean(s.plan.responses[e.context.clipId]?.length) && Boolean(clip?.cues.some(c => c.kind === 'response-window' && c.atMs <= e.atMs && e.atMs < c.endMs));
          }
        },
        interrupted: reason => { mic.current?.stop(reason); if (!latest.current.blocked) latest.current.capture({ kind: 'interruption', reason }); },
      }); engineRef.current = scene; setEngine(scene);
    }).catch(e => { if (!disposed) setNotice(`场景未能启动：${String(e)}`); });
    const beforeUnload = (e: BeforeUnloadEvent) => { if (recorder.recording() || recorder.pending().length) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload);
    return () => { disposed = true; window.removeEventListener('beforeunload', beforeUnload); recorder.dispose(); engineRef.current?.dispose(); engineRef.current = null; };
  }, []);
  useEffect(() => {
    if (!engine) return; const context = mediaContext(session), key = context ? contextKey(context) : '', stage = blocked ? 'disconnected' : session.stage;
    if (applied.current.key === key && applied.current.stage === stage && applied.current.armed === armed) return;
    applied.current = { key, stage, armed };
    const offset = context?.phase === 'practice' ? session.execution!.practiceMs : context?.phase === 'response' ? session.execution!.responseMs : session.positionMs;
    if (!context || blocked || session.stage === 'paused') { engine.pause(context ? offset : undefined); if (!context) engine.clear(); mic.current?.stop(stage); if (['completed', 'aborted'].includes(session.stage)) { mic.current?.close(); } return; }
    if (sceneLoaded.current === key) { if (armed) { engine.pause(offset); void engine.play().catch(e => setNotice(String(e))); } return; }
    const serial = ++loadSerial.current, round = session.plan.assignments.find(a => a.participantId === session.participantId)!.rounds[session.roundIndex];
    void (async () => {
      let clip = clipCache.current.get(context.clipId); if (!clip) { clip = await latest.current.loadClip(context.clipId); clipCache.current.set(context.clipId, clip); }
      if (serial !== loadSerial.current) return;
      await engine.load({ clip, context, condition: context.phase === 'practice' ? 'D' : round.condition, offsetMs: offset });
      if (serial !== loadSerial.current) return; sceneLoaded.current = key;
      const current = latest.current.session; if (armed && ['practice', 'playing', 'responding'].includes(current.stage) && mediaContext(current) && contextKey(mediaContext(current)!) === key && !latest.current.blocked) await engine.play();
    })().catch(e => { setNotice(`片段未能开始：${String(e)}`); if (!latest.current.blocked) latest.current.capture({ kind: 'interruption', reason: 'asset-or-audio-load-failed' }); });
  }, [session, armed, engine, blocked]);
  const panel = useCallback((data: ScenePanel | null) => { engineRef.current?.panel(data); }, []), exitVR = useCallback(() => { void engineRef.current?.exitVR(); }, []);
  const submit = useCallback((answers: Record<string, string | number>) => {
    const s = latest.current.session, timing = s.stage === 'pre-questionnaire' ? 'pre' : s.stage === 'post-questionnaire' ? 'post' : 'round', q = s.plan.questionnaires.find(q => q.timing === timing);
    if (q) latest.current.capture({ kind: 'answers', questionnaireId: q.id, version: q.version, round: s.roundIndex, answers });
  }, []);
  const effectiveStage = session.stage === 'paused' ? session.resumeStage : session.stage;
  const timing = effectiveStage === 'pre-questionnaire' ? 'pre' : effectiveStage === 'round-questionnaire' ? 'round' : effectiveStage === 'post-questionnaire' ? 'post' : null, questionnaire = session.plan.questionnaires.find(q => q.timing === timing);
  useEffect(() => {
    if (!engine || questionnaire) return;
    if (['practice', 'playing', 'responding'].includes(session.stage)) { panel(null); return; }
    panel({ title: session.stage === 'completed' ? '本次预演结束' : session.stage === 'paused' ? '已暂停，请等待恢复' : '等待开始下一阶段', lines: ['Soft Clay Club 三维场景；研究内容待审核。', '当前进度和记录已保留。'], buttons: session.stage === 'paused' && resume ? [{ id: 'resume', label: '恢复播放' }] : advance && ['round-ready', 'break'].includes(session.stage) ? [{ id: 'advance', label: '开始下一阶段' }] : [], choose: id => { if (id === 'advance') advance?.(); if (id === 'resume') resume?.(); } });
  }, [engine, panel, questionnaire, session.stage, advance, resume]);
  async function enable(vr = false) { try { const a = audio.current; if (!a || !engine) throw new Error('场景尚未准备。'); if (session.execution?.audioRequired && !mic.current?.available()) throw new Error('本场次要求先准备实验麦克风。'); const sound = a.unlock(), immersive = vr ? engine.enterVR() : Promise.resolve(); await Promise.all([sound, immersive]); await a.prepareClub(); setArmed(true); if (view.ready && !view.playing && ['practice', 'playing', 'responding'].includes(session.stage)) await engine.play(); setNotice('声音已启用。'); } catch (e) { setNotice(String(e)); } }
  function downloadAudio(segment: AudioSegment) { const url = URL.createObjectURL(segment.blob), link = document.createElement('a'); link.href = url; link.download = `punchcap-measurement-${segment.metadata.id}.${segment.metadata.mime.includes('ogg') ? 'ogg' : 'webm'}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); downloadJson(`punchcap-measurement-${segment.metadata.id}.json`, segment.metadata); }
  const integrity = reportStatus(report);
  const condition = session.stage === 'practice' ? 'D' : session.plan.assignments.find(a => a.participantId === session.participantId)!.rounds[session.roundIndex].condition;
  return <section className="run-system"><div className="run-banner"><strong>完整工程预演</strong><span>Soft Clay Club 三维演员、观众与人群音效；测试表演和草稿问卷 · 不用于正式研究</span></div>
    <div className="run-scene" ref={host}/><div className="work-card"><p role="status">{view.message} · {(view.progressMs / 1000).toFixed(1)} 秒 · {view.fps.toFixed(0)} FPS · {view.drawCalls} 次绘制</p><div className="work-actions"><button disabled={!engine || blocked} onClick={() => void enable()}>启用声音并播放</button><button disabled={!engine || blocked} onClick={() => void enable(true)}>进入 VR</button><button disabled={!engine} onClick={exitVR}>退出 VR</button><button disabled={blocked || !view.playing} onClick={() => props.capture({ kind: 'interruption', reason: 'participant-pause' })}>暂停本轮</button>{session.stage === 'paused' && props.resume && <button onClick={props.resume}>恢复播放</button>}{['round-ready', 'break'].includes(session.stage) && props.advance && <button onClick={props.advance}>开始下一阶段</button>}</div>
    <ul aria-label="当前可操作的花字">{view.captions.map(c => <li key={c.id}>{c.kind === 'expressive' ? '写意' : '间离'}花字 · {c.held ? '已抓取' : '可抓取'}{c.throwable ? ' · 可投掷' : ''}</li>)}</ul><p>桌面：点击或拖动花字、滚轮拉伸；按 H 挂在自己身前，按 T 投向舞台。头显：射线扣扳机抓取，双手拉伸，握把挂载。条件和花字属性共同限制操作。</p><div className="work-actions"><button disabled={!view.playing || condition === 'A'} onClick={() => engine?.grabCaption()}>桌面：抓取花字</button><button disabled={!view.playing || condition === 'A'} onClick={() => engine?.scaleCaption(1.2)}>放大</button><button disabled={!view.playing} onClick={() => engine?.scaleCaption(.8)}>缩小</button><button disabled={!view.playing || condition !== 'D'} onClick={() => engine?.attach()}>挂到自己身前</button><button disabled={!view.playing || condition !== 'D'} onClick={() => engine?.throwToStage()}>投向舞台</button><button disabled={!view.playing} onClick={() => engine?.release()}>松开花字</button></div></div>
    {questionnaire && <RunQuestionnaire key={`${questionnaire.id}:${session.roundIndex}`} questionnaire={questionnaire} disabled={blocked || session.stage === 'paused'} submit={submit} panel={panel} exitVR={exitVR}/>}
    <section className="work-card"><h2>实验麦克风与记录</h2><p>{audioNotice} {session.execution?.audioRequired ? '本场次要求每轮录音。' : '工程预演可不录音，报告会注明。'}</p><div className="work-actions"><button disabled={!engine || micReady} onClick={() => void mic.current?.prepare().then(() => { const ready = Boolean(mic.current?.available()); setMicReady(ready); latest.current.onAudioReady?.(ready); }).catch(e => setAudioNotice(String(e)))}>准备实验麦克风</button><button disabled={!micReady} onClick={() => { mic.current?.close(); setMicReady(false); latest.current.onAudioReady?.(false); }}>关闭实验麦克风</button></div>{segments.map(segment => <p key={segment.metadata.id}>待确认分段 {segment.metadata.id} · {(segment.blob.size / 1024).toFixed(0)} KB <button onClick={() => downloadAudio(segment)}>下载录音和时间标记</button>{props.saveAudio && <button onClick={() => void props.saveAudio!(segment).then(() => { mic.current?.confirmed(segment.metadata.id); setSegments(values => values.filter(s => s.metadata.id !== segment.metadata.id)); setAudioNotice('录音保存已确认。'); }).catch(e => setAudioNotice(String(e)))}>重试保存</button>}</p>)}<button onClick={() => void props.report().then(value => { setReport(value); downloadJson(`punchcap-run-${session.id}.json`, value); }).catch(e => setNotice(String(e)))}>下载记录与完整性报告</button>{integrity && <div role="status"><strong>{integrity.complete ? '工程记录完整性检查通过' : '记录未完整，请复查'}</strong>{integrity.issues.map(item => <p key={item}>{item}</p>)}{integrity.warnings.map(item => <p key={item}>{item}</p>)}</div>}</section><p role="alert">{notice}</p>
  </section>;
}
