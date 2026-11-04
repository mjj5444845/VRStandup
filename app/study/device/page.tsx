import Link from 'next/link';
import { DeviceCheck } from './device-check';
export const metadata = { title: 'Quest 实机测试 · PunchCap' };
export default function Page() { return <main className="workspace formal"><header className="work-nav"><Link href="/">系统首页</Link><Link href="/study/demo">完整流程预演</Link><Link href="/record">演员录制</Link></header><section className="work-hero"><p className="work-eyebrow">QUEST 3 / 集中实机测试</p><h1>跟着提示，一次做完。</h1><p>先检查素材，再进入 VR。每项都可重试或记录问题；不用卡准秒数。PC 可预演场景和操作、读取报告，头显检查由实际 XR 数据确认。记录和测试录音留在当前浏览器，下载后自行保存。</p></section><DeviceCheck/></main>; }
