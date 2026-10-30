import { Dashboard } from './dashboard/dashboard';
import { validateCatalog } from './dashboard/task-model';
import taskCatalog from '@/docs/project/tasks.json';

export const metadata = { title: '开发进度看板 · VR Standup', description: 'VR Standup / PunchCap 的任务归属、系统作用、完成意义与开发进展。' };

export default function HomePage() {
  const catalog = validateCatalog(taskCatalog);
  return <Dashboard catalog={catalog} />;
}
