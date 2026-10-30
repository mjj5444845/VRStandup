import Link from 'next/link';

export default function StudyPage() {
  return (
    <main className="entry">
      <p className="brand">PUNCHCAP / 参与者端</p>
      <h1>现场正在准备</h1>
      <p className="description">实验场景尚未开放，请等待实验员安排。</p>
      <Link className="back" href="/">返回首页</Link>
    </main>
  );
}
