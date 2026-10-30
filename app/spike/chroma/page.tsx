import Link from 'next/link';
import { ChromaCheck } from './chroma-check';
import styles from './chroma.module.css';
export const metadata = { title: '视频去背景检查 · PunchCap' };
export default function ChromaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}><p className="brand">PUNCHCAP / 第五个工作</p><Link href="/spike/media">返回音画同步</Link></header>
      <h1>把绿色背景去掉</h1>
      <p className={styles.intro}>保留画面中的主体，让绿色背景变透明，就能把表演放进三维剧场。这一步叫“色键抠像”。先对照原片，再调整人物边缘。</p>
      <ChromaCheck />
      <p className={styles.note}>原创样片仅检查功能。真实演员的头发、衣服反光、桌面与头显颜色仍需分别检查；此页面不会自动判定 S4 已通过。</p>
    </main>
  );
}
