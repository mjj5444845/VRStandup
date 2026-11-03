import Link from 'next/link';
import { RecordingCheck } from './recording-check';
import styles from '../replay/replay.module.css';

export const metadata = { title: '真实录制检查 · PunchCap' };
export default function RecordingPage() {
  return <main className={styles.page}>
    <header className={styles.header}><p className="brand">PUNCHCAP / 真实录制第一批</p><Link href="/checks">返回技术检查</Link></header>
    <h1>录一小段，再亲自回放。</h1>
    <p className={styles.intro}>先准备麦克风，在 Quest 中进入 VR。平视前方扣一次扳机校准，再扣一次开始录制。随时扣扳机停止，或等待最多 15 秒自动结束；不用卡准时间。</p>
    <RecordingCheck />
    <p className={styles.note}>使用简单头部与双手测试点。采样时钟与校准信息会保留；麦克风物理延迟、完整人体和正式研究同步标准还需后续验证。</p>
  </main>;
}
