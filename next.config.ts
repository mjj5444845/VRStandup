import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
