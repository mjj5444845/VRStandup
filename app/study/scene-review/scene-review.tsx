'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createSceneInspector, type InspectionView } from '../../../study/xr/scene-inspector';

export default function SceneReview() {
  const host=useRef<HTMLDivElement>(null), inspector=useRef<ReturnType<typeof createSceneInspector>|null>(null);
  const [message,setMessage]=useState('正在载入人物与场景。'),[view,setView]=useState<InspectionView>('front'),[playing,setPlaying]=useState(false);
  useEffect(()=>{if(!host.current)return;const s=createSceneInspector(host.current,setMessage);inspector.current=s;return()=>{inspector.current=null;s.dispose();};},[]);
  return <main style={{maxWidth:1280,margin:'auto',padding:'24px',color:'#35443b'}}>
    <nav><Link href="/">系统首页</Link> · <Link href="/study/device">Quest 实机测试</Link></nav>
    <h1 style={{fontSize:36,lineHeight:1.2,margin:'12px 0'}}>人物与场景检查</h1><p style={{fontSize:14}}>同一份实际模型，多角度检查外观、座位和动作。此处使用合成动作，肘部为估算，不代表采集了全身或手指。</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>{([['front','人物正面'],['portrait','面部细节'],['side','人物侧面'],['back','人物背面'],['seated','坐姿与椅子'],['room','全场'],['top','俯视布局']] as const).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);inspector.current?.select(id);}} style={{padding:'10px 16px',background:view===id?'#d9e4d1':'#fff',border:'1px solid #a6b3a0',borderRadius:8}}>{label}</button>)}</div>
    <div ref={host} style={{height:'min(60vh,760px)',minHeight:420,borderRadius:16,overflow:'hidden',background:'#e8dfd1'}}/>
    <p>{message}</p><label>动作进度 <input aria-label="动作进度" type="range" min="0" max="12" step=".1" defaultValue="1" onChange={e=>{setPlaying(false);inspector.current?.play(false);inspector.current?.time(Number(e.target.value));}} style={{width:340}}/></label>
    <button onClick={()=>{setPlaying(!playing);inspector.current?.play(!playing);}} style={{marginLeft:20,padding:10}}>{playing?'暂停动作':'连续播放动作'}</button>
  </main>;
}
