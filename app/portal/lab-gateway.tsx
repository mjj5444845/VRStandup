'use client';
import Link from 'next/link';
import { useState } from 'react';
import { labDestination, type LabDestination } from '@/study/web/lab-address';
export function LabGateway({ destination, title }: { destination: LabDestination; title: string }) {
  const [address, setAddress] = useState(''), [error, setError] = useState('');
  return <main className="workspace formal"><header className="work-nav"><Link href="/">PunchCap 系统首页</Link><Link href="/study">参与者准备</Link></header><section className="work-hero"><p className="work-eyebrow">实验室连接</p><h1>{title}</h1><p>请填写实验员提供的实验室网址。进入后，再在实验室页面输入场次或访问密钥。</p></section><section className="work-card"><form onSubmit={event => { event.preventDefault(); try { const target = labDestination(address, destination); setError(''); window.location.assign(target); } catch (e) { setError(e instanceof Error ? e.message : '地址无效，请检查。'); } }}><label>实验室网址<input type="url" required placeholder="https://实验室地址:端口" value={address} autoComplete="off" onChange={event => setAddress(event.target.value)}/></label><button type="submit" disabled={!address.trim()}>进入实验室页面 →</button><p role="alert">{error}</p></form><p>网址由实验员提供；头显和实验室电脑需要能相互连接。此页不收集密钥、录音或实验记录。当前可进入工程预演，正式实验尚未开放。</p></section></main>;
}
