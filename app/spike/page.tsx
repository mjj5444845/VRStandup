import Link from 'next/link';
import { SceneCheck } from './scene-check';
import styles from './spike.module.css';

export default function SpikePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="brand">PUNCHCAP / 第一个工作</p>
        <Link href="/">返回首页</Link>
      </header>
      <h1 className={styles.title}>先让三维画面动起来</h1>
      <p className={styles.introduction}>
        看到绿色方块，并且它能转动，就说明这个浏览器可以显示我们的基础三维画面。
      </p>
      <SceneCheck />
      <p className={styles.note}><Link href="/spike/xr">下一步：头显连接检查 ↗</Link></p>
      <p className={styles.note}>这是基础显示检查。头显连接检查见下一步，正式舞台将在后续制作。</p>
    </main>
  );
}
