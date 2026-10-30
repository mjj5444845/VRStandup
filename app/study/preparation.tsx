'use client';
import { useState } from 'react';
import { inspectBrowser, type BrowserReport } from '@/study/web/browser-check';
import { downloadJson } from '@/study/web/download-json';

export function Preparation() {
  const [report,setReport]=useState<BrowserReport|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function inspect() {
    setBusy(true);setError('');
    try {setReport(await inspectBrowser());} catch {setReport(null);setError('这次检查未完成，请重新尝试。');} finally {setBusy(false);}
  }
  return <section className="work-card" aria-labelledby="capability-title">
    <div className="work-card-head"><span className="work-step">01</span><div><h2 id="capability-title">检查当前浏览器</h2><p>只检测能力，不进入 VR，不申请录音权限。</p></div></div>
    <div className="work-actions"><button className="work-primary" onClick={inspect} disabled={busy}>{busy?'正在检查…':report?'重新检查':'开始浏览器检查'}</button><button className="work-secondary" disabled={!report||busy} onClick={()=>downloadJson('punchcap-browser-preparation.json',{version:1,purpose:'browser-preparation',report,experimentReady:false})}>下载检查记录</button></div>
    <div className="work-report" aria-live="polite" aria-busy={busy}>
      {!report&&!error&&<div className="work-empty"><span aria-hidden="true">◎</span><h3>先了解这台设备的情况</h3><p>普通电脑可以做网页检查。进入沉浸式 VR，需要在支持 WebXR 的头显浏览器中另行验证。</p></div>}
      {error&&<p role="alert">{error}</p>}
      {report&&<><p className="work-small">本次检查时间：{new Date(report.checkedAt).toLocaleTimeString('zh-CN')}</p>{report.checks.map(check=><div className="work-check-row" key={check.id}><div><h3>{check.name}</h3><p>{check.detail}</p></div><span className={`work-status work-${check.status}`}>{check.status==='pass'?'能力可用':check.status==='blocked'?'需要处理':'当前不可用'}</span></div>)}<p className="work-note">此结果仅描述当前浏览器，不能代替 Windows 或 Quest 3 实机验收。记录下载到本机，不会上传。</p></>}
    </div>
  </section>;
}
