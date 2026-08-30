import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'VR Standup — Virtual Comedy Club',
  description:
    'Step into an intimate virtual comedy club built for browsers and VR headsets.',
  openGraph: {
    title: 'VR Standup — Virtual Comedy Club',
    description:
      'Step into an intimate virtual comedy club built for browsers and VR headsets.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'VR Standup virtual comedy club stage',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VR Standup — Virtual Comedy Club',
    description:
      'Step into an intimate virtual comedy club built for browsers and VR headsets.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
