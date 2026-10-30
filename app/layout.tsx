import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PunchCap · 虚拟脱口秀研究',
  description: 'PunchCap 虚拟脱口秀研究系统',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
