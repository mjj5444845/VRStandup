import Link from 'next/link';
import { Preparation } from './preparation';
export const metadata={title:'参与者准备 · VR Standup'};
export default function StudyPage() {
  return <main className="workspace">
    <header className="work-nav"><Link className="work-brand" href="/">VR Standup<small>PUNCHCAP</small></Link><nav aria-label="项目导航"><Link href="/">系统首页</Link><Link href="/study" aria-current="page">参与者准备</Link><Link href="/lab">实验员工作台</Link><Link href="/checks">技术检查</Link></nav></header>
    <section className="work-hero"><p className="work-eyebrow">参与者入口 / 准备阶段</p><h1>先准备好，<br/>再走进剧场。</h1><p>这里用于了解设备与浏览器的情况。正式剧场、最终演员和评分问卷界面仍在开发；可以进入工程预演，当前不能开始正式研究。</p><span className="work-pill">浏览器检查可用 · 正式实验尚未开放</span></section>
    <section className="work-card"><h2>替代资产完整预演</h2><p>无需配对，先体验练习、四轮、花字互动、评分与数据核查。使用原创工程素材，记录只留在当前浏览器。</p><Link href="/study/demo">体验完整工程预演 →</Link></section><section className="work-card"><h2>会话流程预演</h2><p>已有实验员提供的场次和参与者配对密钥，可进入独立预演端。</p><Link href="/study/session">进入场次预演 →</Link></section><div className="work-columns"><Preparation/><aside className="work-side"><section className="work-card"><p className="work-eyebrow">观看方式</p><h2>同一场表演，<br/>自己的观看视角。</h2><p>演员提前录制动作与声音，三维虚拟演员在剧场中重演。参与者坐在指定位置观看，按实验条件与花字互动。</p><ol className="work-steps"><li><b>完成设备准备</b><span>确认浏览器能力，等待实验员安排。</span></li><li><b>进入指定场次</b><span>由实验员提供预演场次，正式研究等待完整验收。</span></li><li><b>观看与作答</b><span>按已确认的流程观看表演并完成测量。</span></li></ol></section><section className="work-hint"><h2>Mac 上没有 VR 能力？</h2><p>这通常不代表网页损坏。电脑端用于开发和准备，沉浸式场景需要在头显浏览器检查。</p><Link href="/checks">查看已有技术检查 →</Link></section></aside></div>
    <footer className="work-footer">开发阶段入口 · 本页不收集姓名、问卷、录音或实验数据。<a href="https://mjj5444845.github.io/VRStandup/">查看全部开发进度 →</a></footer>
  </main>;
}
