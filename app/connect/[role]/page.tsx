import { notFound } from 'next/navigation';
import { LabGateway } from '@/app/portal/lab-gateway';
const roles = {
  participant: { destination: '/study/session', title: '进入参与者场次' },
  operator: { destination: '/lab/session', title: '进入会话控制台' },
  assets: { destination: '/lab/assets', title: '打开实验室素材库' },
} as const;
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(roles).map(role => ({ role })); }
export const metadata = { title: '连接实验室 · PunchCap' };
export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!Object.hasOwn(roles, role)) notFound();
  return <LabGateway {...roles[role as keyof typeof roles]} />;
}
