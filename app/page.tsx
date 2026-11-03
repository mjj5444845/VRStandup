import { Dashboard } from './dashboard/dashboard';
import { validateCatalog } from './dashboard/task-model';
import taskCatalog from '@/docs/project/tasks.json';
import { Portal } from './portal/portal';

const progressBuild = process.env.PUNCHCAP_BUILD_TARGET === 'pages';
export const metadata = progressBuild
  ? { title: '开发进度看板 · VR Standup', description: 'VR Standup / PunchCap 的任务归属、完成意义与开发进展。' }
  : { title: 'PunchCap · 进入虚拟脱口秀', description: '参与者准备、演员录制与实验员工作台。' };

export default function HomePage() {
  return progressBuild ? <Dashboard catalog={validateCatalog(taskCatalog)} systemOrigin="https://vr-standup.vercel.app" /> : <Portal />;
}
