import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Для Docker оптимизации
};

export default nextConfig;
