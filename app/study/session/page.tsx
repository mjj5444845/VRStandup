import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ParticipantSession } from './participant';
export const metadata = { title: '参与者流程预演 · PunchCap' };
export default function Page() { if (process.env.VERCEL === '1') redirect('/connect/participant'); return <main className="workspace formal"><header className="work-nav"><Link href="/study">参与者准备</Link></header><section className="work-hero"><p className="work-eyebrow">完整流程 / 参与者</p><h1>按实验员安排进入场次。</h1><p>完整工程场次会载入 Soft Clay Club 剧场、动作、声音和问卷；请使用实验员提供的场次信息。研究模式等待内容审核与设备验收。</p></section><ParticipantSession/></main>; }
