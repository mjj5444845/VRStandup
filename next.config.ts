import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export always builds in .next; keep the running laboratory separate.
  distDir: '.next-lab',
  ...(process.env.PUNCHCAP_BUILD_TARGET === 'pages' ? {
    output: 'export' as const,
    basePath: '/VRStandup',
    trailingSlash: true,
    distDir: '.next-pages',
  } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
