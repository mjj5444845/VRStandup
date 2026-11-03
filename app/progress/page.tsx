import { redirect } from 'next/navigation';
import { Dashboard } from '@/app/dashboard/dashboard';
import { validateCatalog } from '@/app/dashboard/task-model';
import tasks from '@/docs/project/tasks.json';
export const metadata = { title: '开发进度看板 · PunchCap' };
export default function Page() {
  if (process.env.VERCEL === '1') redirect('https://mjj5444845.github.io/VRStandup/');
  return <Dashboard catalog={validateCatalog(tasks)} />;
}
