import Link from 'next/link';
import styles from './portal.module.css';

export function Portal() {
  return <main className={styles.portal}>
    <header className={styles.header}><Link className={styles.brand} href="/">PUNCHCAP<span>虚拟脱口秀</span></Link><a href="https://mjj5444845.github.io/VRStandup/">开发进度 ↗</a></header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>一场表演 · 你的观看视角</p><h1>走进剧场，<br/>让笑点发生。</h1><p className={styles.intro}>戴上头显，在虚拟剧场中观看演员表演，体验文字与空间交织的互动。</p><Link className={styles.primary} href="/study">我是参与者 <span aria-hidden="true">→</span></Link><p><Link href="/study/demo">先参观 Soft Clay Club 并体验完整预演 ↗</Link></p><p className={styles.availability}><span/>设备准备与流程预演可用 · 正式实验尚未开放</p></div>
      <div className={styles.scene} role="img" aria-label="舞台与观众席的简化示意"><div className={styles.beam}/><div className={styles.stage}><span>PUNCHCAP</span><div className={styles.microphone}/></div><div className={styles.seats}>{Array.from({length:24},(_,i)=><i key={i}/>)}</div><span className={styles.sceneNote}>同一场表演，自己的位置。</span></div>
    </section>
    <section className={styles.roles} aria-label="选择使用身份">
      <article><span className={styles.number}>01 / 参与者</span><h2>准备观看</h2><p>检查浏览器和头显，按实验员的安排进入指定场次。</p><Link href="/study">进入参与者准备 <span aria-hidden="true">↗</span></Link></article>
      <article><span className={styles.number}>02 / 演员</span><h2>录下你的表演</h2><p>校准头部与双手，录制声音和动作，保存后回放复查。</p><Link href="/record">进入演员录制 <span aria-hidden="true">↗</span></Link></article>
      <article><span className={styles.number}>03 / 实验员</span><h2>安排一场实验</h2><p>核对准备情况，进入实验室工作台管理素材与会话。</p><Link href="/lab">进入实验员工作台 <span aria-hidden="true">↗</span></Link></article>
    </section>
    <footer className={styles.footer}><p>使用 Quest 3 等支持 WebXR 的头显浏览器观看。请先等待实验员说明。</p><p>录制和会话数据保存在本机或实验室服务。<a href="https://mjj5444845.github.io/VRStandup/">查看项目进展 ↗</a></p></footer>
  </main>;
}
