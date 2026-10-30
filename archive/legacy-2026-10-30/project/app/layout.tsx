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
  title: 'VR Standup — Indoor WebXR Comedy Theater',
  description:
    'Choose a performer and step into a softly lit indoor comedy theater built for browsers and VR headsets.',
  openGraph: {
    title: 'VR Standup — Indoor WebXR Comedy Theater',
    description:
      'Choose a performer and step into a softly lit indoor comedy theater built for browsers and VR headsets.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'VR Standup — Indoor WebXR Comedy Theater',
    description:
      'Choose a performer and step into a softly lit indoor comedy theater built for browsers and VR headsets.',
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
