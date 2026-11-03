import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SessionConsole } from './session-console';
export const metadata = { title: '实验室会话控制 · PunchCap' };
export default function SessionPage() { if (process.env.VERCEL === '1') redirect('/connect/operator'); return <main className="workspace formal"><header className="work-nav"><Link href="/">系统首页</Link><nav><Link href="/lab">准备工作台</Link><Link href="/lab/assets">私密素材库</Link><Link href="/record">演员录制</Link></nav></header><section className="work-hero"><p className="work-eyebrow">完整流程 / 实验员</p><h1>一份状态，控制两端。</h1><p>当前开放工程预演。使用实验室 3002 服务，导入配置、配对参与者并验证会话流程。选择完整工程配置可运行三维场景、问卷与测量；正式研究保持关闭。</p></section><SessionConsole/></main>; }
