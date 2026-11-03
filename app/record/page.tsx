import Link from 'next/link';
import { Recorder } from './recorder';
export const metadata = { title: '演员录制与复查 · PunchCap' };
export default function RecordPage() { return <main className="workspace formal"><header className="work-nav"><Link href="/">系统首页</Link><nav><Link href="/lab/session">会话控制</Link><Link href="/lab/assets">私密素材库</Link></nav></header><section className="work-hero"><p className="work-eyebrow">M3 / 演员预录</p><h1>校准，录制，再复查。</h1><p>进入 VR 后扣一次扳机校准，再扣一次开始，录完再扣一次结束。单轮最多 180 秒为工程上限；文件只在本机处理。正式资产、物理同步和设备长时测试集中验收。</p></section><Recorder/></main>; }
