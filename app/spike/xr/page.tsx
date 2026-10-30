import Link from 'next/link';
import { SceneCheck } from '../scene-check';
import styles from '../spike.module.css';

export default function XrCheckPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="brand">PUNCHCAP / 第二个工作</p>
        <Link href="/spike">返回三维检查</Link>
      </header>
      <h1 className={styles.title}>准备连接头显</h1>
      <p className={styles.introduction}>
        先确认连接方式，再检查浏览器是否能进入 VR。普通电脑没有 VR 设备时，进入按钮会保持灰色。
      </p>
      <SceneCheck enableVR />
      <p className={styles.note}><Link href="/spike/network">下一步：两个网页传消息 ↗</Link></p>
      <p className={styles.note}>在头显中请使用实验电脑提供的 HTTPS 地址。这里尚未接入正式实验流程或数据记录。</p>
    </main>
  );
}
