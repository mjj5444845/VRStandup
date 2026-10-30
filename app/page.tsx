import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="entry">
      <p className="brand">PUNCHCAP</p>
      <h1>脱口秀的另一种现场</h1>
      <p className="description">虚拟脱口秀研究系统</p>
      <nav className="entries" aria-label="系统入口">
        <Link href="/study">参与者入口 <span aria-hidden="true">↗</span></Link>
        <Link href="/lab">实验员入口 <span aria-hidden="true">↗</span></Link>
        <Link href="/spike">三维画面检查 <span aria-hidden="true">↗</span></Link>
      </nav>
    </main>
  );
}
