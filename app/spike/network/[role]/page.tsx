import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NetworkCheck } from '../network-check';
import styles from '../network.module.css';

export const dynamicParams = false;
export function generateStaticParams() { return [{ role: 'console' }, { role: 'participant' }]; }

export default async function NetworkRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== 'console' && role !== 'participant') notFound();
  const isConsole = role === 'console';
  return (
    <main className={styles.page}>
      <header className={styles.header}><p className="brand">PUNCHCAP / 通信检查</p><Link href="/spike/network">返回操作入口</Link></header>
      <h1>{isConsole ? '实验员端' : '参与者端'}</h1>
      <p className={styles.intro}>{isConsole ? '等两个角色都显示已就绪，再发送一条测试指令。' : '保持这页打开，收到指令后会自动回复实验员端。'}</p>
      <NetworkCheck role={role} />
      <p className={styles.note}>你还需要在另一个标签页打开 <Link href={isConsole ? '/spike/network/participant' : '/spike/network/console'} target="_blank" rel="noopener">{isConsole ? '参与者端 ↗' : '实验员端 ↗'}</Link>。测试只传递消息，不播放媒体、不写入实验数据。</p>
    </main>
  );
}
