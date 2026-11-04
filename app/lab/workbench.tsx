'use client';
import { useState } from 'react';
import { CAPTION_LABELS, CONDITION_IDS, getCondition, captionPermissions, canPlayResponse, type ConditionId, type CaptionKind } from '@/study/core/conditions';
import { inspectBrowser, type BrowserReport } from '@/study/web/browser-check';
import { downloadJson } from '@/study/web/download-json';
const PREPARATION = [
  {id:'space',title:'查看座位与活动范围',detail:'实地确认通道畅通、座位稳定，头显附近没有障碍。'},
  {id:'devices',title:'确认设备与声音',detail:'确认头显、手柄电量及音频输出；浏览器能力检查不能代替实际试听。'},
  {id:'materials',title:'核对研究与素材版本',detail:'实际使用前确认演员片段、条件安排及正式问卷；当前页面不生成分配表。'},
  {id:'storage',title:'确认数据保存与备份',detail:'原始资料留在授权位置，实验数据不放入公开 Git 仓库。'},
] as const;
export function Workbench() {
  const [condition,setCondition]=useState<ConditionId>('A');
  const [kind,setKind]=useState<CaptionKind>('expressive');
  const [throwable,setThrowable]=useState(false);
  const [target,setTarget]=useState<'self'|'other'>('self');
  const [played,setPlayed]=useState(0);
  const [checked,setChecked]=useState<string[]>([]);
  const [report,setReport]=useState<BrowserReport|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const rule=getCondition(condition), permissions=captionPermissions(condition,{kind,throwable},target);
  async function inspect() {setBusy(true);setMessage('');try{setReport(await inspectBrowser());}catch{setReport(null);setMessage('检查未完成，请重新尝试。');}finally{setBusy(false);}}
  function reset(){setChecked([]);setReport(null);setCondition('A');setKind('expressive');setThrowable(false);setTarget('self');setPlayed(0);setMessage('本页准备清单和预览已重置。');}
  return <>
    <div className="work-columns work-lab-columns"><section className="work-card" aria-labelledby="conditions-title"><div className="work-card-head"><span className="work-step">01</span><div><h2 id="conditions-title">条件规则预览</h2><p>来自当前系统设计；切换只影响本页预览，不会分配实验条件。</p></div></div>
      <div className="work-condition-tabs" role="group" aria-label="预览实验条件">{CONDITION_IDS.map(id=><button key={id} aria-pressed={condition===id} onClick={()=>setCondition(id)}><b>{id}</b><span>{getCondition(id).name}</span></button>)}</div>
      <div className="work-condition-summary" aria-live="polite"><h3>{condition} 条件 · {rule.name}</h3><p>{rule.captions.length?`显示${rule.captions.map(k=>CAPTION_LABELS[k]).join('与')}花字`:'不显示花字'}；{rule.grab?'允许抓取':'不允许抓取'}；{rule.responses?'允许在窗口内播放预录回应，同一段子最多两次':'不允许演员回应'}。</p></div>
      <div className="work-form"><label>花字类别<select aria-label="花字类别" value={kind} onChange={e=>setKind(e.target.value as CaptionKind)}><option value="expressive">写意花字</option><option value="distancing">间离花字</option></select></label><label>挂载对象<select aria-label="挂载对象" value={target} onChange={e=>setTarget(e.target.value as 'self'|'other')}><option value="self">参与者自己</option><option value="other">其他对象</option></select></label><label>该段子已播放回应<select aria-label="该段子已播放回应" value={played} onChange={e=>setPlayed(Number(e.target.value))}><option value={0}>0 次</option><option value={1}>1 次</option><option value={2}>2 次</option></select></label><label className="work-inline-check"><input type="checkbox" checked={throwable} onChange={e=>setThrowable(e.target.checked)}/>素材标记为可投掷</label></div>
      <dl className="work-permissions" aria-live="polite">{[['显示',permissions.visible],['抓取',permissions.grab],['投掷',permissions.throw],['挂载',permissions.attach],['再播放回应',canPlayResponse(condition,played)]].map(([label,allowed])=><div key={String(label)}><dt>{label}</dt><dd className={allowed?'work-allowed':''}>{allowed?'允许':'不允许'}</dd></div>)}</dl><p className="work-note">写意花字不可投掷；投掷还要求 D 条件与素材许可同时成立。挂载仅限参与者自身。预录回应的实际时间窗由会话模块检查。</p>
      <details className="work-details"><summary>查看完整 A／B／C／D 对照表</summary><div className="work-table-wrap"><table><caption>当前设计规则，不含实验顺序分配</caption><thead><tr><th>条件</th><th>花字</th><th>抓取</th><th>投掷 / 自身挂载</th><th>回应</th></tr></thead><tbody>{CONDITION_IDS.map(id=>{const r=getCondition(id);return <tr key={id}><th>{id}</th><td>{r.captions.map(k=>CAPTION_LABELS[k]).join('与')||'无'}</td><td>{r.grab?'是':'否'}</td><td>{r.throw?'是，另受素材限制':'否'}</td><td>{r.responses?'是，最多两次':'否'}</td></tr>;})}</tbody></table></div></details>
    </section>
    <aside className="work-card"><div className="work-card-head"><span className="work-step">02</span><div><h2>本机能力检查</h2><p>检测当前电脑，不代表头显已连接。</p></div></div><button className="work-secondary" onClick={inspect} disabled={busy}>{busy?'正在检查…':'检查工作台浏览器'}</button><div className="work-report" aria-live="polite" aria-busy={busy}>{report?report.checks.map(c=><div className="work-check-row" key={c.id}><div><h3>{c.name}</h3><p>{c.detail}</p></div><span className={`work-status work-${c.status}`}>{c.status==='pass'?'可用':c.status==='blocked'?'需处理':'不可用'}</span></div>):<p className="work-small">检查安全连接、三维图形、声音与 WebXR 接口。</p>}</div><p className="work-note">会话、素材和数据保存已接入实验室服务；请从会话控制入口开展工程预演。正式研究仍需完成内容和设备验收。</p></aside></div>
    <section className="work-card work-prep-list" aria-labelledby="preparation-title"><div className="work-section-heading"><div><p className="work-eyebrow">03 / 实验前准备</p><h2 id="preparation-title">逐项核对，保留本机记录。</h2><p className="work-small">这是人工准备清单，刷新会清空，不改变项目任务的验收状态。</p></div><span className="work-progress">{checked.length}<small> / {PREPARATION.length} 项</small></span></div><div className="work-checklist">{PREPARATION.map(item=><label key={item.id}><input type="checkbox" checked={checked.includes(item.id)} onChange={e=>setChecked(previous=>e.target.checked?[...previous,item.id]:previous.filter(id=>id!==item.id))}/><span><b>{item.title}</b><small>{item.detail}</small></span></label>)}</div><div className="work-export-row"><p role="status" aria-live="polite">{message||'下载内容仅包含本页勾选、条件预览和浏览器能力，不包含参与者信息。'}</p><div className="work-actions"><button className="work-secondary" disabled={busy} onClick={reset}>重置本页准备</button><button className="work-primary" disabled={!report||busy} onClick={()=>{downloadJson('punchcap-lab-preparation.json',{version:1,purpose:'lab-preparation',checked,conditionPreview:condition,report,experimentReady:false});setMessage('已发起本机记录下载，请在浏览器下载列表中确认文件。');}}>下载准备记录</button></div></div></section>
  </>;
}
