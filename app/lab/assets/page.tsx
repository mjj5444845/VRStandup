import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AssetLibrary } from './library';
export const metadata = { title: '本机私密素材库 · PunchCap' };
export default function Page() { if (process.env.VERCEL === '1') redirect('/connect/assets'); return <main className="workspace formal"><header className="work-nav"><Link href="/lab/session">会话控制</Link><nav><Link href="/record">录制与回放复查</Link><Link href="/">系统首页</Link></nav></header><section className="work-hero"><p className="work-eyebrow">M3 / 本机私密素材</p><h1>保留原件，审核工作副本。</h1><p>素材仅发送到当前实验室电脑。声音、动作及校验清单保存在本机私密目录；不会上传 GitHub。新版本使用新编号，已有文件不会被覆盖。</p></section><AssetLibrary/></main>; }
