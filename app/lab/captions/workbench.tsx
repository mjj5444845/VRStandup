'use client';
import { useState } from 'react';
import { engineeringPlan } from '@/study/core/engineering';
import { inspectCaptionDraft, type CaptionDraft } from '@/study/core/caption-draft';
import { downloadJson } from '@/study/web/download-json';

function example(): CaptionDraft {
  const clip = engineeringPlan().clips.find(c => c.kind === 'main')!;
  return { schema: 'punchcap-caption-draft-v1', id: 'draft-example', durationMs: clip.durationMs, cues: clip.cues, components: clip.cues.filter(c => c.kind === 'expressive' || c.kind === 'distancing').map(c => ({ cueId: c.id, expressiveTypes: [], represents: '', performance: '', imagination: '', commentary: '', renderer: 'png-plane', source: '项目工程图形；语义需另行设计，不作为研究刺激。' })) };
}
export function CaptionWorkbench() {
  const [source, setSource] = useState(() => JSON.stringify(example(), null, 2));
  const [report, setReport] = useState<ReturnType<typeof inspectCaptionDraft> | null>(null);
  const [message, setMessage] = useState('请补充组件说明，再检查。');
  function edit(value: string) { setSource(value); setReport(null); setMessage('内容已改变，请重新检查。'); }
  function check() { try { setReport(inspectCaptionDraft(JSON.parse(source))); setMessage('格式与时间规则检查完成，请查看逐项结果。'); } catch (e) { setReport(null); setMessage(e instanceof Error ? e.message : '提示单读取失败。'); } }
  return <><section className="work-card"><h2>编辑分组件提示单</h2><p>W1物件、W2行动、W3空间、W4角色、W5状态；分类不改变A–D交互权限。混合事件必须拆成两项。当前支持头部、左右手和舞台锚点的PNG平面。</p><label>读取本机提示单 <input type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setMessage('提示单超过2 MiB工程上限。'); return; } void file.text().then(edit).catch(() => setMessage('文件读取失败。')); }}/></label><label>提示单JSON<textarea aria-label="提示单JSON" style={{width:'100%',minHeight:380}} value={source} onChange={e => edit(e.target.value)}/></label><div className="work-actions"><button onClick={check}>检查提示单</button><button onClick={() => edit(JSON.stringify(example(), null, 2))}>载入工程模板</button><button disabled={!report} onClick={() => { if (report) downloadJson(`punchcap-caption-${report.draft.id}.json`, report.draft); }}>下载提示单</button><button disabled={!report} onClick={() => { if (report) downloadJson(`punchcap-caption-review-${report.draft.id}.json`, report); }}>下载检查报告</button></div><p role="status">{message}</p></section>{report && <section className="work-card"><h2>{report.engineeringReady ? '可进入工程素材复查' : '仍有内容或实现缺口'}</h2>{report.components.map(c => <article className="work-hint" key={c.cueId}><h3>{c.cueId}</h3><ul>{c.issues.length ? c.issues.map(i => <li key={i}>{i}</li>) : <li>当前工程能力和说明字段匹配。</li>}</ul><p>{Object.entries(c.permissions).map(([condition,p]) => `${condition}：${p.visible ? '显示' : '隐藏'}${p.grab ? ' / 抓取' : ''}${p.throw ? ' / 投掷' : ''}${p.attach ? ' / 自身挂载' : ''}`).join('；')}</p></article>)}<h3>正式研究仍待人工验收</h3><ul>{report.pending.map(p => <li key={p}>{p}</li>)}</ul></section>}</>;
}
