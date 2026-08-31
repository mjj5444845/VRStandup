import type { Metadata } from 'next';
import './globals.css';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelProductionHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const siteUrl = configuredSiteUrl
  ? /^https?:\/\//.test(configuredSiteUrl)
    ? configuredSiteUrl
    : `https://${configuredSiteUrl}`
  : vercelProductionHost
    ? `https://${vercelProductionHost}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'VR Standup — Open-Air WebXR Comedy',
  description:
    'Choose a performer and step into a bright open-air comedy stage built for browsers and VR headsets.',
  openGraph: {
    title: 'VR Standup — Open-Air WebXR Comedy',
    description:
      'Choose a performer and step into a bright open-air comedy stage built for browsers and VR headsets.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'VR Standup sunny open-air WebXR comedy stage',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VR Standup — Open-Air WebXR Comedy',
    description:
      'Choose a performer and step into a bright open-air comedy stage built for browsers and VR headsets.',
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
