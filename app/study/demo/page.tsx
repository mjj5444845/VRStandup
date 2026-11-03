import Link from 'next/link';
import { EngineeringRun } from './run';
export const metadata = { title: '完整工程预演 · PunchCap' };
export default function Page() { return <main className="workspace formal"><header className="work-nav"><Link href="/">系统首页</Link><Link href="/study">参与者准备</Link></header><section className="work-hero"><p className="work-eyebrow">Soft Clay Club / 完整流程</p><h1>先把一场实验跑通。</h1><p>在 Soft Clay Club 剧场中体验练习、四轮、回应和问卷。当前表演动作与节拍为工程测试内容。数据只留在当前浏览器，下载后自行保存；不会作为研究结果上传。</p></section><EngineeringRun/></main>; }
