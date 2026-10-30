import Link from 'next/link';
import { MediaCheck } from './media-check';
import styles from './media.module.css';

export const metadata = { title: '声音与视频同步检查 · PunchCap' };

export default function MediaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}><p className="brand">PUNCHCAP / 第四个工作</p><Link href="/spike/network">返回通信检查</Link></header>
      <h1>让声音带着画面走</h1>
      <p className={styles.intro}>先准备测试素材，再连续播放 60 秒。画面跟随声音计时，我们记录它们的偏差。这一步叫“音画同步检查”。</p>
      <MediaCheck />
      <p className={styles.note}>这里使用全新生成的计时画面和节拍声，没有演员录像。偏差表示视频时间减去音频时间；正数是画面领先，负数是画面落后。</p>
      <p className={styles.note}><Link href="/spike/chroma">下一步：视频去背景检查 ↗</Link></p>
      <p className={styles.note}>通过标准：完整连续 60 秒，所有采样的最大绝对偏差小于 40 毫秒。Mac 通过也需要在 Windows 和头显分别实测；当前检查不测扬声器与显示屏的物理输出延迟。</p>
    </main>
  );
}
