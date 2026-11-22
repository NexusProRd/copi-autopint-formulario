import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/copi-autopint-formulario',
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
