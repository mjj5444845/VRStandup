import Link from 'next/link';

export default function LabPage() {
  return (
    <main className="entry">
      <p className="brand">PUNCHCAP / 实验员端</p>
      <h1>实验控制台</h1>
      <p className="description">控制台正在建设中，当前尚不能启动实验。</p>
      <Link className="back" href="/">返回首页</Link>
    </main>
  );
}
