import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ParticipantSession } from './participant';
export const metadata = { title: '参与者流程预演 · PunchCap' };
export default function Page() { if (process.env.VERCEL === '1') redirect('/connect/participant'); return <main className="workspace formal"><header className="work-nav"><Link href="/study">参与者准备</Link></header><section className="work-hero"><p className="work-eyebrow">M4 / 双端流程预演</p><h1>按实验员安排进入场次。</h1><p>当前为工程预演：按钮只模拟媒体和问卷完成，不收集真实问卷答案，不代表已经进入正式剧场。</p></section><ParticipantSession/></main>; }
