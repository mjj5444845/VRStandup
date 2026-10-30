import Link from 'next/link';
import catalog from '@/docs/project/tasks.json';
import { STATUS } from '../dashboard/task-model';
export const metadata={title:'技术检查目录 · VR Standup'};
export default function ChecksPage(){
 const tasks=catalog.tasks.filter(t=>(t.kind==='spike'||t.kind==='reference')&&'route' in t&&t.id!=='T03');
 return <main className="workspace"><header className="work-nav"><Link className="work-brand" href="/">VR Standup<small>PUNCHCAP</small></Link><nav aria-label="项目导航"><Link href="/">开发看板</Link><Link href="/study">参与者准备</Link><Link href="/lab">实验员工作台</Link><Link href="/checks" aria-current="page">技术检查</Link></nav></header><section className="work-hero"><p className="work-eyebrow">独立运行 / 技术验证</p><h1>一次验证一件事。</h1><p>从这里进入已有的技术检查。每页有各自的检查步骤与结果；Mac 的结果不能替代 Windows 和头显实测。</p><span className="work-pill">视频相关页面保留为历史参考</span></section><div className="work-check-grid">{tasks.map(task=><article className="work-card" key={task.id}><p className="work-eyebrow">{task.id} / {task.module}</p><h2>{task.title}</h2><span className="work-status work-unavailable">{STATUS[task.status as keyof typeof STATUS].label}</span><p>{task.purpose}</p><p className="work-small">{task.current}</p>{'route' in task&&<Link className="work-open" href={task.route as string}>打开{task.kind==='reference'?'参考':'检查'}页面 ↗</Link>}</article>)}</div><footer className="work-footer">双端通信页面需要检查服务；当前 3001 服务已提供该入口。<Link href="/">查看开发计划与全部任务 →</Link></footer></main>;
}
