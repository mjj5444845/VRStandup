'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createSceneInspector, type InspectionMotion, type InspectionView } from '../../../study/xr/scene-inspector';

export default function SceneReview() {
  const host=useRef<HTMLDivElement>(null), inspector=useRef<ReturnType<typeof createSceneInspector>|null>(null);
  const [message,setMessage]=useState('正在载入人物与场景。'),[view,setView]=useState<InspectionView>('front'),[playing,setPlaying]=useState(false);
  const [seat,setSeat]=useState(1),[eyeHeight,setEyeHeight]=useState(1.2);
  useEffect(()=>{if(!host.current)return;const s=createSceneInspector(host.current,setMessage);inspector.current=s;return()=>{inspector.current=null;s.dispose();};},[]);
  return <main style={{maxWidth:1280,margin:'auto',padding:'24px',color:'#35443b'}}>
    <nav><Link href="/">系统首页</Link> · <Link href="/study/device">Quest 实机测试</Link></nav>
    <h1 style={{fontSize:36,lineHeight:1.2,margin:'12px 0'}}>人物与场景检查</h1><p style={{fontSize:14}}>查看实际人物、分开的手指与场景。动作库是预设动画；三点跟随是合成头手数据，肘部为估算、手指为预设，不代表真人全身录制。</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>{([['front','人物正面'],['portrait','面部细节'],['side','人物侧面'],['back','人物背面'],['hands','手部细节'],['seated','坐姿与椅子'],['room','全场'],['top','俯视布局'],['seat','观众眼位'],['stage','舞台看观众'],['access','侧门与踏步']] as const).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);inspector.current?.select(id);}} style={{padding:'10px 16px',background:view===id?'#d9e4d1':'#fff',border:'1px solid #a6b3a0',borderRadius:8}}>{label}</button>)}</div>
    <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:12}}>
      <label>检查座位 <select aria-label="检查座位" value={seat} onChange={e=>{const value=Number(e.target.value);setSeat(value);setView('seat');inspector.current?.seat(value,eyeHeight);}}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{i+1}号 · {i<12?'圆桌区':'后排区'}</option>)}</select></label>
      <label>工程眼高 <select aria-label="工程眼高" value={eyeHeight} onChange={e=>{const value=Number(e.target.value);setEyeHeight(value);setView('seat');inspector.current?.seat(seat,value);}}>{[1.1,1.2,1.3].map(h=><option key={h} value={h}>{h.toFixed(2)}米</option>)}</select></label>
      <span style={{fontSize:13}}>24座 / 4桌 · 工程采样，真实头显保留原始眼高</span>
    </div>
    <label style={{display:'block',marginBottom:12}}>动作来源 <select aria-label="动作来源" defaultValue="talk" onChange={e=>inspector.current?.motion(e.target.value as InspectionMotion)}>{([['talk','预设 · 自然说话'],['explain','预设 · 解释手势'],['standing-idle','预设 · 放松站立'],['wave','预设 · 挥手'],['tracking','三点跟随 · 合成检查数据']] as const).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <div ref={host} style={{height:'min(60vh,760px)',minHeight:420,borderRadius:16,overflow:'hidden',background:'#e8dfd1'}}/>
    <p>{message}</p><label>动作进度 <input aria-label="动作进度" type="range" min="0" max="12" step=".1" defaultValue="1" onChange={e=>{setPlaying(false);inspector.current?.play(false);inspector.current?.time(Number(e.target.value));}} style={{width:340}}/></label>
    <button onClick={()=>{setPlaying(!playing);inspector.current?.play(!playing);}} style={{marginLeft:20,padding:10}}>{playing?'暂停动作':'连续播放动作'}</button>
  </main>;
}
