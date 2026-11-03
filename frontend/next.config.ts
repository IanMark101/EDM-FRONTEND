import type { NextConfig } from "next";
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  turbopack: { root: fileURLToPath(new URL('../', import.meta.url)) },
};

export default nextConfig;
