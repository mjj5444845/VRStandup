import Link from 'next/link';
import { CaptionWorkbench } from './workbench';
export const metadata = { title: '花字提示单 · PunchCap' };
export default function CaptionPage() {
  return <main className="workspace"><header className="work-nav"><Link href="/lab">返回实验员工作台</Link><Link href="/study/scene-review">场景复查</Link></header><section className="work-hero"><p className="work-eyebrow">内容准备 / concept-2.0</p><h1>把参考拆成可检查的组件。</h1><p>写意和间离分别记录语义、锚点与时机。提示单只在当前浏览器处理；不会上传内容或批准正式研究。</p></section><CaptionWorkbench/></main>;
}
