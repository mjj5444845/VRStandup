import Link from 'next/link';
import { ReplayCheck } from './replay-check';
import styles from './replay.module.css';
export const metadata = { title: '三维动作回放检查 · PunchCap' };
export default function ReplayPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}><p className="brand">PUNCHCAP / 第六个工作</p><Link href="/">返回首页</Link></header>
      <h1>让动作跟着声音重演</h1>
      <p className={styles.intro}>先用一段 12 秒的测试动作，检查头部和双手能否按声音进度回放。切换观看角度时，演员仍重演同一段动作。这一步叫“动作与声音回放验证”。</p>
      <ReplayCheck />
      <p className={styles.note}>使用程序生成的动作和节拍声，没有演员录音。灰色躯干是静态占位，头部和双手是测试点；这里尚未接入真实录制、完整人体、表情或口型。</p>
    </main>
  );
}
