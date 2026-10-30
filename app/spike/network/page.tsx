import Link from 'next/link';
import styles from './network.module.css';

export default function NetworkPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}><p className="brand">PUNCHCAP / 第三个工作</p><Link href="/spike/xr">返回头显检查</Link></header>
      <h1>让两个网页说上话</h1>
      <p className={styles.intro}>先在当前电脑打开两个角色，发送一条测试指令，再看回复是否回来。头显可以等之后再接。</p>
      <div className={styles.steps}>
        <section><span className={styles.number}>01</span><h2>打开实验员端</h2><p>用来发送指令、查看回复。每种角色只打开一页。</p><Link href="/spike/network/console" target="_blank" rel="noopener">打开实验员端 ↗</Link></section>
        <section><span className={styles.number}>02</span><h2>打开参与者端</h2><p>模拟头显收到指令，并自动回复。两页保持打开。</p><Link href="/spike/network/participant" target="_blank" rel="noopener">打开参与者端 ↗</Link></section>
      </div>
      <p className={styles.note}>本步骤请使用通信检查服务，Mac 运行 npm run spike:net；Windows 运行 npm.cmd run spike:net。完整准备步骤见 06 操作说明。</p>
      <p className={styles.note}>网页与消息连接使用同一个端口，专业上叫 WebSocket 同端口验证。这里不能启动正式实验。</p>
      <p className={styles.note}><Link href="/spike/media">下一步：声音与视频同步检查 ↗</Link></p>
    </main>
  );
}
